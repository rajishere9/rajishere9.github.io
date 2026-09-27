// Collectors: each source type turns an upstream feed or API into a list of candidate items.
import { XMLParser } from "fast-xml-parser";
import { LAB_SOURCES, NEWS_SOURCES, HF_ORGS, GH_ORGS, REDDIT_GROUPS, BLUESKY_QUERIES, TOPIC_RE, LIMITS, OFFICIAL_DOMAINS } from "./config.mjs";
import { http, httpText, httpJson, pool, hash, normUrl, stripHtml, clip, parseDate, hoursAgo, domainOf, log, sleep, resolveRedirect } from "./util.mjs";
import * as gemini from "./gemini.mjs";

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: true, htmlEntities: true });

const val = (v) => (v == null ? "" : typeof v === "object" ? (v["#text"] ?? v["@_href"] ?? "") : String(v));
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export const isOfficialUrl = (u) => { const d = domainOf(u); return OFFICIAL_DOMAINS.some((o) => d === o || d.endsWith("." + o)); };

function item(src, { url, title, snippet = "", publishedAt = null, engagement = "", image = null, kind, official }) {
  const clean = normUrl(url);
  return {
    id: hash(clean),
    url,
    title: clip(stripHtml(title), 220),
    snippet: clip(stripHtml(snippet), 420),
    source: src.id,
    kind: kind || src.kind || "news",
    official: official ?? (!!src.official || isOfficialUrl(url)),
    seedOnly: !!src.seedOnly,
    publishedAt,
    engagement,
    image,
    weight: src.weight || 1,
  };
}

function parseFeed(text) {
  const doc = xml.parse(text);
  if (doc.rss) return arr(doc.rss.channel?.item).map((it) => ({
    title: val(it.title),
    url: val(it.link) || val(it.guid),
    date: val(it.pubDate) || val(it["dc:date"]),
    snippet: val(it.description) || val(it["content:encoded"]),
    image: it["media:content"]?.["@_url"] || arr(it["media:thumbnail"])[0]?.["@_url"] || (/(jpe?g|png|webp)/i.test(it.enclosure?.["@_type"] || "") ? it.enclosure?.["@_url"] : null),
  }));
  if (doc.feed) return arr(doc.feed.entry).map((it) => {
    const link = arr(it.link).find((l) => !l["@_rel"] || l["@_rel"] === "alternate") || arr(it.link)[0];
    return {
      title: val(it.title),
      url: link?.["@_href"] || val(link),
      date: val(it.published) || val(it.updated),
      snippet: val(it.summary) || val(it.content),
      image: it["media:thumbnail"]?.["@_url"] || null,
    };
  });
  const rdf = doc["rdf:RDF"];
  if (rdf) return arr(rdf.item).map((it) => ({ title: val(it.title), url: val(it.link), date: val(it["dc:date"]), snippet: val(it.description) }));
  return [];
}

async function collectRss(src) {
  const text = await httpText(src.url, { timeout: 25000, browser: /scmp|nature|science\.org/.test(src.url) });
  let entries = parseFeed(text).filter((e) => e.url && e.title).slice(0, src.maxItems || 60);
  if (src.aiOnly) entries = entries.filter((e) => TOPIC_RE.test(`${e.title} ${stripHtml(e.snippet).slice(0, 400)}`));
  return entries.map((e) => item(src, {
    url: e.url.trim(),
    title: e.title,
    snippet: e.snippet,
    publishedAt: parseDate(e.date),
    image: e.image,
    kind: src.seedOnly ? "search" : src.official ? "official" : src.science ? "science" : "news",
  }));
}

// Newsrooms without feeds: collect article links matching a path pattern. Undated, so only new links count.
async function collectLinks(src) {
  const html = await httpText(src.url, { timeout: 25000, browser: true });
  const origin = new URL(src.url).origin;
  const re = new RegExp(src.pattern);
  const found = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let href = m[1].replace(/&amp;/g, "&");
    if (href.startsWith(origin)) href = href.slice(origin.length);
    if (!re.test(href)) continue;
    const url = origin + href;
    const text = stripHtml(m[2]);
    const prev = found.get(url);
    if (!prev || text.length > prev.length) found.set(url, text);
  }
  return [...found].slice(0, 40).map(([url, text]) => {
    const fromSlug = url.split("/").filter(Boolean).pop().replace(/[-_]/g, " ");
    return item(src, { url, title: text.length > 12 ? text : fromSlug, kind: "official", official: true });
  });
}

async function collectHN() {
  const since = Math.floor(Date.now() / 1000) - 36 * 3600;
  const data = await httpJson(`https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points%3E%3D50,created_at_i%3E${since}&hitsPerPage=100`);
  const src = { id: "hackernews", kind: "community" };
  return data.hits.filter((h) => h.title).map((h) => item(src, {
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    title: h.title,
    publishedAt: parseDate(h.created_at),
    engagement: `Hacker News: ${h.points} points, ${h.num_comments} comments`,
  })).filter((it) => TOPIC_RE.test(it.title) || it.official);
}

// Reddit without an API app: one combined RSS request per group of subreddits ("top of the day"),
// waiting out Reddit's rate-limit window between requests.
async function collectRedditAll() {
  const src = { id: "reddit", kind: "community" };
  const out = [];
  const errors = [];
  for (const group of REDDIT_GROUPS) {
    try {
      const res = await http(`https://www.reddit.com/r/${group.join("+")}/top/.rss?t=day&limit=60`, { retries: 0 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const entries = parseFeed(await res.text());
      for (const e of entries) {
        const sub = (e.url.match(/\/r\/([^/]+)\//) || [])[1] || group[0];
        const outbound = (e.snippet.match(/href="(https?:\/\/(?!www\.reddit\.com|i\.redd\.it|v\.redd\.it|preview\.redd\.it)[^"]+)">\[link\]/) || [])[1];
        out.push(item(src, { url: outbound || e.url, title: e.title, snippet: e.snippet, publishedAt: parseDate(e.date), engagement: `top of r/${sub} today` }));
      }
      const reset = +(res.headers.get("x-ratelimit-reset") || 0);
      const remaining = +(res.headers.get("x-ratelimit-remaining") ?? 1);
      await sleep(remaining < 1 ? (reset + 2) * 1000 : 1500);
    } catch (e) {
      errors.push(`${group[0]}…: ${e.message}`);
      await sleep(8000);
    }
  }
  if (!out.length && errors.length) throw new Error(errors.join("; "));
  return out;
}

async function collectBluesky(q) {
  const since = new Date(Date.now() - 8 * 3600e3).toISOString();
  const data = await httpJson(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=top&since=${since}&limit=30&lang=en`);
  const src = { id: "bluesky", kind: "community" };
  return (data.posts || []).filter((p) => (p.likeCount || 0) >= 40).map((p) => {
    const ext = p.embed?.external?.uri || p.record?.embed?.external?.uri;
    const rkey = p.uri.split("/").pop();
    return item(src, {
      url: ext || `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
      title: clip(p.record?.text || "", 200),
      snippet: `@${p.author.handle}: ${p.record?.text || ""}`,
      publishedAt: parseDate(p.record?.createdAt || p.indexedAt),
      engagement: `Bluesky: ${p.likeCount} likes, ${p.repostCount || 0} reposts`,
    });
  });
}

const QUANT_RE = /gguf|awq|gptq|mlx|-fp8|fp4|int4|int8|bnb|4bit|8bit|onnx|exl2|-quant|nvfp4|w4a16|-dynamic|lora$/i;

async function collectHfOrg(org) {
  const data = await httpJson(`https://huggingface.co/api/models?author=${encodeURIComponent(org)}&sort=createdAt&direction=-1&limit=6&full=false`);
  const src = { id: "hf-orgs", kind: "official", official: true };
  return data.filter((m) => !QUANT_RE.test(m.id)).map((m) => item(src, {
    url: `https://huggingface.co/${m.id}`,
    title: `${org} published ${m.id} on Hugging Face${m.pipeline_tag ? ` (${m.pipeline_tag})` : ""}`,
    publishedAt: parseDate(m.createdAt),
    engagement: `${m.likes || 0} likes, ${m.downloads || 0} downloads`,
  }));
}

async function collectHfTrending() {
  const data = await httpJson("https://huggingface.co/api/models?sort=trendingScore&limit=40");
  const src = { id: "hf-trending", kind: "community" };
  return data.filter((m) => !QUANT_RE.test(m.id) && hoursAgo(parseDate(m.createdAt) || 0) < 7 * 24).map((m) => item(src, {
    url: `https://huggingface.co/${m.id}`,
    title: `Trending on Hugging Face: ${m.id}${m.pipeline_tag ? ` (${m.pipeline_tag})` : ""}`,
    publishedAt: parseDate(m.createdAt),
    engagement: `${m.likes || 0} likes, trending`,
  }));
}

async function collectHfPapers() {
  const data = await httpJson("https://huggingface.co/api/daily_papers?limit=50");
  const src = { id: "hf-papers", kind: "research" };
  return data.filter((d) => (d.paper?.upvotes || 0) >= 25).map((d) => item(src, {
    url: `https://arxiv.org/abs/${d.paper.id}`,
    title: d.paper.title,
    snippet: d.paper.summary,
    publishedAt: parseDate(d.publishedAt || d.paper.publishedAt),
    engagement: `${d.paper.upvotes} upvotes on Hugging Face Papers`,
  }));
}

const ghHeaders = () => (process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json" } : { accept: "application/vnd.github+json" });

async function collectGhOrg(org) {
  const data = await httpJson(`https://api.github.com/orgs/${org}/repos?sort=created&direction=desc&per_page=5`, { headers: ghHeaders() });
  const src = { id: "github-orgs", kind: "official", official: true };
  return data.filter((r) => !r.fork && !r.archived).map((r) => item(src, {
    url: r.html_url,
    title: `${org} published a new GitHub repository: ${r.name}${r.description ? ` — ${r.description}` : ""}`,
    snippet: r.description || "",
    publishedAt: parseDate(r.created_at),
    engagement: `${r.stargazers_count} stars`,
  }));
}

async function collectGhRising() {
  const since = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  const data = await httpJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(`created:>${since} stars:>250`)}&sort=stars&order=desc&per_page=25`, { headers: ghHeaders() });
  const src = { id: "github-rising", kind: "community" };
  return data.items.filter((r) => TOPIC_RE.test(`${r.name} ${r.description || ""} ${(r.topics || []).join(" ")}`)).map((r) => item(src, {
    url: r.html_url,
    title: `Fast-rising on GitHub: ${r.full_name}${r.description ? ` — ${r.description}` : ""}`,
    snippet: r.description || "",
    publishedAt: parseDate(r.created_at),
    engagement: `${r.stargazers_count} stars in under 3 days`,
  }));
}

// Gemini with Google Search: a periodic net for anything the feeds missed (X-first news included).
async function collectSweep() {
  const now = new Date().toISOString();
  const { value } = await gemini.json({
    model: process.env.MODEL_SWEEP || undefined,
    tools: [{ google_search: {} }],
    temperature: 0.2,
    prompt: `It is ${now}. Use Google Search to find the most important news published in the last 6 hours about: new AI model releases (frontier labs and Chinese labs such as DeepSeek, Qwen/Alibaba, Moonshot/Kimi, Zhipu/Z.ai, MiniMax, ByteDance, Tencent, Baidu), open-source AI releases, AI audio/music/voice and video generation, AI agents and developer tools, AI policy and industry deals, AI chips, robotics, and major science or technology breakthroughs worldwide. Include news that broke on X/Twitter or Reddit if reputable outlets or official pages confirm it.
Only include items you found in search results from the last 6 hours, with the exact URL of an official page or a reputable outlet. Do not include anything older, and do not guess URLs. Up to 15 items.`,
    schema: {
      type: "object",
      properties: { items: { type: "array", items: { type: "object", properties: {
        headline: { type: "string" }, summary: { type: "string" }, url: { type: "string" }, published: { type: "string", description: "ISO date-time if known" },
      }, required: ["headline", "summary", "url"] } } },
      required: ["items"],
    },
  });
  const src = { id: "gemini-sweep", kind: "search" };
  const found = (value.items || []).filter((x) => /^https?:\/\//.test(x.url || ""));
  await Promise.all(found.map(async (x) => { x.url = await resolveRedirect(x.url); }));
  return found.filter((x) => x.url).map((x) => item(src, {
    url: x.url, title: x.headline, snippet: x.summary, publishedAt: parseDate(x.published) || Date.now(),
  }));
}

// Runs every collector, isolates failures, and returns fresh unseen items plus per-source health.
export async function collectAll(state) {
  const first = !state.meta?.firstRunDone;
  const maxAge = first ? 24 : LIMITS.itemMaxAgeHours;
  const jobs = [
    ...LAB_SOURCES.map((s) => ({ id: s.id, run: () => (s.type === "rss" ? collectRss(s) : collectLinks(s)), undated: s.type === "links" })),
    ...NEWS_SOURCES.map((s) => ({ id: s.id, run: () => collectRss(s) })),
    { id: "hackernews", run: collectHN },
    { id: "reddit", run: collectRedditAll },
    ...BLUESKY_QUERIES.map((q, i) => ({ id: `bluesky-${i}`, run: () => collectBluesky(q) })),
    ...HF_ORGS.map((org) => ({ id: `hf-${org}`, run: () => collectHfOrg(org), maxAge: 48 })),
    { id: "hf-trending", run: collectHfTrending, maxAge: 7 * 24 },
    { id: "hf-papers", run: collectHfPapers, maxAge: 48 },
    ...GH_ORGS.map((org) => ({ id: `gh-${org}`, run: () => collectGhOrg(org), maxAge: 48 })),
    { id: "github-rising", run: collectGhRising, maxAge: 72 },
  ];
  const sweepDue = Date.now() - (state.meta?.lastSweep || 0) > LIMITS.sweepEveryMinutes * 60e3 - 5 * 60e3;
  if (sweepDue && process.env.GEMINI_API_KEY) jobs.push({ id: "gemini-sweep", run: collectSweep, maxAge: 12 });

  state.sources ||= {};
  const results = await pool(jobs, 12, async (job) => {
    const t0 = Date.now();
    try {
      const items = await job.run();
      state.sources[job.id] = { ...state.sources[job.id], ok: Date.now(), fails: 0, count: items.length, ms: Date.now() - t0 };
      return { job, items };
    } catch (e) {
      const prev = state.sources[job.id] || {};
      state.sources[job.id] = { ...prev, fails: (prev.fails || 0) + 1, err: String(e.message || e).slice(0, 160), errAt: Date.now() };
      return { job, items: [] };
    }
  });
  if (sweepDue) state.meta.lastSweep = Date.now();

  const fresh = [];
  const byId = new Set();
  for (const { job, items } of results) {
    const src = state.sources[job.id];
    const baselining = job.undated && !src.baselined;
    for (const it of items) {
      if (state.seen[it.id] || byId.has(it.id)) continue;
      if (baselining) { state.seen[it.id] = Date.now(); continue; }
      if (it.publishedAt && hoursAgo(it.publishedAt) > (job.maxAge || maxAge)) { state.seen[it.id] = Date.now(); continue; }
      if (it.publishedAt && it.publishedAt > Date.now() + 36e5 * 6) it.publishedAt = Date.now();
      byId.add(it.id);
      fresh.push(it);
    }
    if (job.undated) src.baselined = true;
  }
  const failing = Object.entries(state.sources).filter(([, s]) => s.fails >= 3).map(([id]) => id);
  log(`collect: ${results.reduce((n, r) => n + r.items.length, 0)} items from ${jobs.length} sources, ${fresh.length} new${failing.length ? `, failing: ${failing.join(", ")}` : ""}`);
  return fresh;
}

