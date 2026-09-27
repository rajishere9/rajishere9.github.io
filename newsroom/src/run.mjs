// One newsroom run: collect → triage → research → write + fact-check → images → publish → render.
// Usage: node src/run.mjs [--render-only] [--dry] [--max N]
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS, SITE, MODELS } from "./config.mjs";
import { collectAll } from "./collect.mjs";
import { triage, mergeAndSelect } from "./triage.mjs";
import { research } from "./research.mjs";
import { vetRealImages, buildFigures } from "./images.mjs";
import { updatePlay } from "./play.mjs";
import { writeStory } from "./write.mjs";
import { renderSite } from "./render.mjs";
import { usage } from "./gemini.mjs";
import { log, today, hoursAgo, domainOf, slugify } from "./util.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NEWSROOM = path.resolve(HERE, "..");
const ROOT = path.resolve(NEWSROOM, "..");
const STATE_DIR = path.join(NEWSROOM, "state");
const POSTS_DIR = path.join(NEWSROOM, "posts");
const DRAFTS_DIR = path.join(STATE_DIR, "drafts");
const INDEXNOW_KEY = "c198d8f7000a1b1c5a78c89b5bcc689a";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const started = Date.now();

// Local runs read secrets from newsroom/.env (never committed).
try {
  for (const line of (await fs.readFile(path.join(NEWSROOM, ".env"), "utf8")).split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 1) + "\n");
}

async function loadPosts() {
  const files = (await fs.readdir(POSTS_DIR).catch(() => [])).filter((f) => f.endsWith(".json"));
  return Promise.all(files.map((f) => readJson(path.join(POSTS_DIR, f))));
}

const SOURCE_NAMES = { hackernews: "Hacker News", bluesky: "Bluesky", "gemini-sweep": "Google Search", "hf-orgs": "Hugging Face", "hf-trending": "Hugging Face", "hf-papers": "Hugging Face Papers", "github-orgs": "GitHub", "github-rising": "GitHub", techmeme: "Techmeme" };
function foundVia(items) {
  const names = [...new Set(items.map((i) => SOURCE_NAMES[i.source] || (i.source.startsWith("reddit") ? "Reddit" : i.source.startsWith("gnews") ? "Google News" : domainOf(i.url))))].slice(0, 3);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] || "news feeds";
}

async function uniqueSlug(slug) {
  let s = slug || "story";
  for (let n = 2; ; n++) {
    try { await fs.access(path.join(POSTS_DIR, `${s}.json`)); s = `${slug}-${n}`; } catch { return s; }
  }
}

// Pings Bing, Yandex and other IndexNow engines. In Actions this runs after the Pages deploy (see the workflow).
async function indexNow(urls) {
  if (!urls.length || !flag("--ping")) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE.origin).host, key: INDEXNOW_KEY, keyLocation: `${SITE.origin}/${INDEXNOW_KEY}.txt`, urlList: urls }),
      signal: AbortSignal.timeout(15000),
    });
    log(`indexnow: ${res.status} for ${urls.length} URL(s)`);
  } catch (e) {
    log(`indexnow: ${e.message}`);
  }
}

async function publishStory(story, state) {
  story.attempts = (story.attempts || 0) + 1;
  log(`story: ${story.headline}`);
  const { sources, reject } = await research(story);
  if (reject) {
    story.retryAfter = Date.now() + 40 * 60e3;
    if (/not recent|old/.test(reject)) story.attempts = 99;
    return { skipped: reject };
  }

  let real = [];
  if (LIMITS.realImageShare > 0) try { real = await vetRealImages(sources, story); } catch (e) { log(`images: vetting failed: ${e.message}`); }

  const result = await writeStory(story, sources, real);
  if (result.rejected) {
    await writeJson(path.join(DRAFTS_DIR, `${today()}-${slugify(story.headline, 50)}.json`), { reason: result.rejected, story: { ...story, items: story.items.map((i) => i.url) }, draft: result.draft, check: result.check, sources: sources.map(({ images, ...s }) => ({ ...s, text: s.text.slice(0, 400) })) });
    story.retryAfter = Date.now() + 60 * 60e3;
    if (/not recent|not newsworthy/.test(result.rejected)) story.attempts = 99;
    return { skipped: result.rejected };
  }

  const d = result.draft;
  const slug = await uniqueSlug(d.slug);
  if (flag("--dry")) return { post: { slug, title: d.title } };
  const figs = await buildFigures([d.hero, ...d.figures], real, { outDir: path.join(ROOT, "blog"), slug });
  const hero = figs.find((f) => f.slot === "hero") || figs[0] || null;
  const now = Date.now();
  const linked = new Set([...d.body.matchAll(/\]\((https?:[^)\s]+)\)/g)].map((m) => m[1]));
  const used = new Set(d.sourcesUsed || []);
  const post = {
    slug,
    title: d.title,
    seoTitle: d.seoTitle,
    description: d.description,
    dek: d.dek,
    category: d.category,
    tags: d.tags,
    keyTakeaways: d.keyTakeaways,
    body: d.body,
    faq: d.faq,
    hero: hero && { ...hero, slot: undefined },
    og: hero?.og,
    figures: figs.filter((f) => f !== hero).map((f) => ({ ...f, og: undefined })),
    sources: sources.filter((s) => used.has(s.n) || linked.has(s.url) || s.official).map(({ n, url, title, site, published, official }) => ({ n, url, title, site, published, official })),
    publishedAt: now,
    updatedAt: now,
    foundVia: foundVia(story.items),
    check: { claims: result.check.claims.length, score: result.check.score },
    story: { id: story.id, score: story.score, items: story.items.map((i) => i.url).slice(0, 20) },
    models: { writer: MODELS.writer, checker: MODELS.checker },
  };
  if (!post.sources.length) post.sources = sources.map(({ n, url, title, site, published, official }) => ({ n, url, title, site, published, official }));
  await writeJson(path.join(POSTS_DIR, `${slug}.json`), post);
  state.stories.covered.push({ slug, headline: story.headline, at: now });
  return { post };
}

async function main() {
  const state = await readJson(path.join(STATE_DIR, "state.json"), {});
  state.meta ||= {};
  state.stories ||= { pending: [], covered: [] };
  state.daily ||= { date: today(), count: 0 };
  if (state.daily.date !== today()) state.daily = { date: today(), count: 0 };
  state.seen = await readJson(path.join(STATE_DIR, "seen.json"), {});

  // The GitHub schedule is only a fallback for the Cloudflare trigger: skip it if a run just happened.
  const last = Date.parse(state.runs?.[0]?.at || 0);
  if (process.env.SKIP_IF_RAN_WITHIN_MIN && Date.now() - last < +process.env.SKIP_IF_RAN_WITHIN_MIN * 60e3) {
    log("run: a run finished recently, skipping this fallback run");
    return;
  }

  const summary = { at: new Date().toISOString(), published: [], skipped: [] };
  if (!flag("--render-only")) {
    const items = await collectAll(state);
    let stories = [];
    if (items.length) {
      stories = await triage(items, state);
      for (const it of items) state.seen[it.id] = Date.now();
    }
    const max = args.includes("--max") ? +args[args.indexOf("--max") + 1] : LIMITS.postsPerRun;
    const slots = Math.min(max, LIMITS.postsPerDay - state.daily.count);
    const chosen = mergeAndSelect(stories, state, slots);
    summary.collected = items.length;

    for (const story of chosen) {
      if ((Date.now() - started) / 60e3 > LIMITS.runBudgetMinutes * 0.65) { log("run: time budget reached, leaving the rest for the next run"); break; }
      try {
        const r = await publishStory(story, state);
        if (r.post) {
          state.stories.pending = state.stories.pending.filter((p) => p.id !== story.id);
          if (!flag("--dry")) state.daily.count++;
          summary.published.push(r.post.slug);
          log(`published: ${SITE.origin}${SITE.base}/${r.post.slug}/`);
        } else {
          summary.skipped.push(`${story.headline}: ${r.skipped}`);
          log(`skipped: ${r.skipped}`);
        }
      } catch (e) {
        story.retryAfter = Date.now() + 30 * 60e3;
        summary.skipped.push(`${story.headline}: error ${e.message}`);
        log(`error: ${e.stack || e.message}`);
      }
    }
    state.meta.firstRunDone = true;
  }

  if (!flag("--dry")) {
    const posts = await loadPosts();
    await renderSite({ root: ROOT, posts });
    // Games data is cheap to skip: leave it for the next run if this one is already long.
    if ((!flag("--render-only") || flag("--play")) && (Date.now() - started) / 60e3 < 18) await updatePlay({ root: ROOT, posts, state });
    await indexNow(summary.published.map((s) => `${SITE.origin}${SITE.base}/${s}/`).concat(summary.published.length ? [`${SITE.origin}${SITE.base}/`] : []));
  }

  // Prune and persist state.
  for (const [k, t] of Object.entries(state.seen)) if (hoursAgo(t) > 24 * 6) delete state.seen[k];
  state.stories.covered = state.stories.covered.filter((c) => hoursAgo(c.at) < 24 * 14);
  for (const f of await fs.readdir(DRAFTS_DIR).catch(() => [])) {
    const stat = await fs.stat(path.join(DRAFTS_DIR, f));
    if (hoursAgo(stat.mtimeMs) > 24 * 7) await fs.rm(path.join(DRAFTS_DIR, f));
  }
  summary.minutes = +((Date.now() - started) / 60e3).toFixed(1);
  summary.gemini = { calls: usage.calls, inputTokens: usage.input, outputTokens: usage.output, images: usage.images, searches: usage.searches };
  state.runs = [summary, ...(state.runs || [])].slice(0, 150);
  const { seen, ...rest } = state;
  if (!flag("--dry")) {
    await writeJson(path.join(STATE_DIR, "state.json"), rest);
    await fs.writeFile(path.join(STATE_DIR, "seen.json"), JSON.stringify(seen) + "\n");
  }
  log(`run: done in ${summary.minutes} min — published ${summary.published.length}, skipped ${summary.skipped.length}, ${usage.calls} Gemini calls, ${usage.images} images`);
  if (process.env.GITHUB_OUTPUT) {
    const urls = summary.published.map((s) => `${SITE.origin}${SITE.base}/${s}/`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `published=${summary.published.length}\nurls=${JSON.stringify(urls.length ? [...urls, `${SITE.origin}${SITE.base}/`] : [])}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
