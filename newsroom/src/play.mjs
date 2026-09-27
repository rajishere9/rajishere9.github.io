// Data for the /play games: Epoch AI's model dataset for The Scale of AI (weekly),
// and a daily AI-dle puzzle whose clues come only from our published, fact-checked posts.
import fs from "node:fs/promises";
import path from "node:path";
import * as gemini from "./gemini.mjs";
import { MODELS } from "./config.mjs";
import { httpText, log, clip, hoursAgo } from "./util.mjs";

const EPOCH_CSV = "https://epoch.ai/data/notable_ai_models.csv";
const AIDLE_LAUNCH = "2026-09-27";
const CLUES = 6;

// Minimal RFC 4180 CSV parser (quoted fields may contain commas, quotes and newlines).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}

const COUNTRY = {
  "United States of America": "USA", "United Kingdom of Great Britain and Northern Ireland": "UK", "Korea (Republic of)": "South Korea",
  "Russian Federation": "Russia", "Taiwan, Province of China": "Taiwan", "Iran (Islamic Republic of)": "Iran", "Viet Nam": "Vietnam",
  "United Arab Emirates": "UAE", "Netherlands (Kingdom of the)": "Netherlands", "Türkiye": "Turkey",
};
const country = (c) => COUNTRY[c] || c;
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
const split = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

function buildScale(rows) {
  const models = rows
    .filter((r) => num(r["Training compute (FLOP)"]) && /^\d{4}-\d{2}-\d{2}$/.test(r["Publication date"]))
    .map((r) => ({
      n: r.Model,
      o: split(r.Organization).slice(0, 2).join(", "),
      d: r["Publication date"],
      f: +num(r["Training compute (FLOP)"]).toPrecision(3),
      p: num(r.Parameters) ? +num(r.Parameters).toPrecision(3) : undefined,
      $: num(r["Training compute cost (2023 USD)"]) ? Math.round(num(r["Training compute cost (2023 USD)"])) : undefined,
      k: { Confident: "c", Likely: "l", Speculative: "s" }[r.Confidence] || "s",
      m: split(r.Domain)[0] || "Other",
      h: split(r["Training hardware"])[0] || undefined,
      q: num(r["Hardware quantity"]) || undefined,
      x: r["Frontier model"] === "True" ? 1 : undefined,
      w: /open/i.test(r["Open model weights?"] || r["Model accessibility"] || "") && !/unreleased|closed|api/i.test(r["Model accessibility"] || "") ? 1 : undefined,
      c: country(split(r["Country (of organization)"])[0] || "") || undefined,
      a: clip((r.Abstract || "").replace(/\s+/g, " "), 190) || undefined,
      u: /^https?:\/\//.test(r.Link) ? split(r.Link)[0] : undefined,
    }))
    .sort((a, b) => a.f - b.f);

  // Frontier training compute growth since 2010: least-squares fit of log10(FLOP) against years.
  const fr = models.filter((m) => m.x && m.d >= "2010");
  const xs = fr.map((m) => Date.parse(m.d) / (365.25 * 864e5)), ys = fr.map((m) => Math.log10(m.f));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return { models, growth: fr.length > 10 ? +(10 ** slope).toFixed(1) : null, frontierCount: fr.length };
}

// Autocomplete list for AI-dle: every organisation and model Epoch tracks, plus names from our own posts.
function buildEntities(rows) {
  const orgs = new Map(), models = new Map();
  for (const r of rows) {
    const os = split(r.Organization), cs = split(r["Country (of organization)"]);
    os.forEach((o, i) => {
      const c = country(cs[i] || cs[0] || "");
      const e = orgs.get(o.toLowerCase()) || { n: o, t: "org", votes: {} };
      if (c) e.votes[c] = (e.votes[c] || 0) + 1;
      orgs.set(o.toLowerCase(), e);
    });
    if (r.Model && !models.has(r.Model.toLowerCase())) models.set(r.Model.toLowerCase(), { n: r.Model, t: "model", o: os[0] || undefined });
  }
  const orgList = [...orgs.values()].map(({ votes, ...e }) => ({ ...e, c: Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] }));
  return [...orgList, ...models.values()];
}

async function writeIfChanged(file, value) {
  const next = JSON.stringify(value) + "\n";
  const prev = await fs.readFile(file, "utf8").catch(() => "");
  if (prev === next) return false;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, next);
  return true;
}

// Weekly: refresh the model dataset behind The Scale of AI and the AI-dle entity list.
export async function refreshScale({ root, state, force = false }) {
  state.play ||= {};
  if (!force && state.play.scaleAt && hoursAgo(state.play.scaleAt) < 24 * 7) return;
  const rows = parseCsv(await httpText(EPOCH_CSV, { timeout: 60000 }));
  if (rows.length < 500) throw new Error(`Epoch dataset looks incomplete (${rows.length} rows)`);
  const scale = buildScale(rows);
  const changed = await writeIfChanged(path.join(root, "play/scale-of-ai/data.json"), {
    source: { name: "Epoch AI, Data on Notable AI Models", url: "https://epoch.ai/data/notable-ai-models", license: "CC BY 4.0" },
    updated: new Date().toISOString().slice(0, 10), ...scale,
  });
  const entFile = path.join(root, "play/ai-dle/entities.json");
  const current = JSON.parse(await fs.readFile(entFile, "utf8").catch(() => "[]"));
  const merged = new Map(buildEntities(rows).map((e) => [`${e.t}:${e.n.toLowerCase()}`, e]));
  for (const e of current) if (!merged.has(`${e.t}:${e.n.toLowerCase()}`)) merged.set(`${e.t}:${e.n.toLowerCase()}`, e);
  await writeIfChanged(entFile, [...merged.values()].sort((a, b) => a.n.localeCompare(b.n)));
  state.play.scaleAt = Date.now();
  log(`play: scale data ${changed ? "updated" : "unchanged"}, ${scale.models.length} models, frontier growth ${scale.growth}x/year`);
}

// Light obfuscation so the answer isn't readable at a glance in the JSON (it's a game, not a secret).
export function seal(obj, date) {
  const key = Buffer.from(`rkj-${date}-aidle`);
  const buf = Buffer.from(JSON.stringify(obj));
  return buf.map((b, i) => b ^ key[i % key.length]).toString("base64");
}

function unseal(text, date) {
  const key = Buffer.from(`rkj-${date}-aidle`);
  return JSON.parse(Buffer.from(text, "base64").map((b, i) => b ^ key[i % key.length]).toString());
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const leaks = (text, names) => names.some((n) => n.length >= 2 && ` ${norm(text)} `.includes(` ${norm(n)} `));
const ts = (p) => (typeof p.publishedAt === "number" ? p.publishedAt : Date.parse(p.publishedAt));
const dayNumber = (date) => Math.round((Date.parse(date) - Date.parse(AIDLE_LAUNCH)) / 864e5) + 1;
const addDays = (date, n) => new Date(Date.parse(date) + n * 864e5).toISOString().slice(0, 10);

const puzzleSchema = {
  type: "object",
  properties: {
    answer: { type: "string", description: "Canonical name, e.g. \"Anthropic\" or \"Gemini 3.5 Pro\"" },
    type: { type: "string", enum: ["org", "model"], description: "org = company, lab, university or agency; model = AI model or AI product" },
    aliases: { type: "array", items: { type: "string" }, description: "Other names players might type for the same answer" },
    maker: { type: "string", description: "For a model: the organisation that made it, exactly as the posts name it. Empty for an org." },
    clues: { type: "array", items: { type: "string" }, minItems: CLUES, maxItems: CLUES },
    blurb: { type: "string", description: "One sentence shown after the game: what this answer was in the news for" },
    slugs: { type: "array", items: { type: "string" }, description: "Slugs of the posts the clues come from" },
    decoys: { type: "array", items: { type: "object", properties: { n: { type: "string" }, t: { type: "string", enum: ["org", "model"] } }, required: ["n", "t"] }, description: "Other organisations and AI models/products named in the posts" },
  },
  required: ["answer", "type", "aliases", "clues", "blurb", "slugs", "decoys"],
};

const verifySchema = {
  type: "object",
  properties: {
    clues: { type: "array", items: { type: "object", properties: { supported: { type: "boolean" }, problem: { type: "string" } }, required: ["supported"] } },
    guessable: { type: "boolean", description: "True if a tech-savvy reader could reasonably get the answer by the last clue" },
  },
  required: ["clues", "guessable"],
};

async function makePuzzle(date, posts, recentAnswers) {
  const postsBlock = posts.map((p) => `[POST ${p.slug}] ${p.title} (${new Date(ts(p)).toISOString().slice(0, 10)})\n${p.dek}\n${clip(p.body.replace(/\[\[FIG\d\]\]/g, ""), 5000)}\n[END POST]`).join("\n\n");
  let feedback = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { value: z } = await gemini.json({
      model: MODELS.writer, temperature: 0.7, thinking: "medium", schema: puzzleSchema,
      prompt: `You are setting today's AI-dle, a daily guessing game on a tech news site. Players guess a mystery organisation (company, lab, university, agency) or AI model/product from ${CLUES} clues, revealed one at a time.
Pick ONE mystery answer that is central to at least one post below, well known enough that a tech-savvy reader could get it, and backed by enough facts in the posts for ${CLUES} good clues. Don't pick any of these recent answers: ${recentAnswers.join(", ") || "none"}.
Write ${CLUES} clues, from hard and oblique (clue 1) to nearly giving it away (clue ${CLUES}). Each clue is one crisp sentence under 140 characters, playful but precise, using ONLY facts stated in the posts (never your own knowledge, which is outdated). Recent-news clues are great. Clues must never contain the answer's name, any alias or any part of the name; for a model, only the final clue may name its maker.
List as decoys the other organisations and AI models/products named in the posts.
${feedback}
POSTS:
${postsBlock}`,
    });
    const names = [z.answer, ...(z.aliases || [])];
    if (!z.answer || z.clues?.length !== CLUES) { feedback = "Your last attempt was malformed."; continue; }
    const leaked = z.clues.filter((c) => leaks(c, names));
    if (leaked.length) { feedback = `Your last attempt leaked the answer in: ${leaked.join(" | ")}. Rewrite those clues.`; continue; }
    const { value: v } = await gemini.json({
      model: MODELS.checker, temperature: 0, thinking: "high", schema: verifySchema,
      prompt: `Check each numbered clue for a guessing game whose answer is "${z.answer}". A clue is supported only if the POSTS state every fact in it about ${z.answer} (wordplay is fine; facts must be exact). Return one verdict per clue, in order.
CLUES:
${z.clues.map((c, i) => `${i + 1}. ${c}`).join("\n")}

POSTS:
${postsBlock}`,
    });
    const bad = z.clues.filter((c, i) => !v.clues?.[i]?.supported);
    if (!bad.length && v.guessable && v.clues?.length === CLUES) return z;
    feedback = `A fact-checker rejected your last puzzle (answer "${z.answer}"): ${bad.map((c, i) => `"${c}"${v.clues?.[z.clues.indexOf(c)]?.problem ? ` (${v.clues[z.clues.indexOf(c)].problem})` : ""}`).join("; ") || "not guessable"}. Fix it using only facts in the posts.`;
    log(`play: puzzle attempt ${attempt + 1} rejected (${bad.length} unsupported clue(s))`);
  }
  return null;
}

// Daily: make sure today's puzzle exists, and tomorrow's once the day's news has come in
// (players east of UTC reach tomorrow first).
export async function ensurePuzzles({ root, posts, state }) {
  state.play ||= {};
  const dir = path.join(root, "play/ai-dle/puzzles");
  const index = JSON.parse(await fs.readFile(path.join(dir, "index.json"), "utf8").catch(() => "[]"));
  const now = new Date(), todayUtc = now.toISOString().slice(0, 10);
  const want = [todayUtc, ...(now.getUTCHours() >= 9 ? [addDays(todayUtc, 1)] : [])].filter((d) => !index.some((p) => p.date === d));
  if (!want.length) return false;

  posts = [...posts].sort((a, b) => ts(b) - ts(a));
  const entFile = path.join(root, "play/ai-dle/entities.json");
  const entities = JSON.parse(await fs.readFile(entFile, "utf8").catch(() => "[]"));
  const find = (n, t) => entities.find((e) => e.t === t && norm(e.n) === norm(n));
  let made = false;
  for (const date of want) {
    if (state.play.failedAt?.[date] && hoursAgo(state.play.failedAt[date]) < 2) continue;
    const fresh = posts.filter((p) => !p.hidden && hoursAgo(ts(p)) < 72).slice(0, 10);
    const pool = fresh.length >= 3 ? fresh : posts.filter((p) => !p.hidden).slice(0, 10);
    const recent = [];
    for (const p of index.slice(-30)) {
      const f = JSON.parse(await fs.readFile(path.join(dir, `${p.date}.json`), "utf8").catch(() => "null"));
      if (f) recent.push(unseal(f.secret, f.date).answer);
    }
    const z = await makePuzzle(date, pool, recent);
    if (!z) { (state.play.failedAt ||= {})[date] = Date.now(); log(`play: no puzzle for ${date} yet`); continue; }

    // Feedback data for wrong guesses: same country (orgs) or same maker (models).
    const known = find(z.answer, z.type);
    const secret = {
      answer: z.answer, aliases: z.aliases || [], blurb: z.blurb,
      country: z.type === "org" ? known?.c || "" : "",
      maker: z.type === "model" ? z.maker || known?.o || "" : "",
      posts: (z.slugs || []).filter((s) => posts.some((p) => p.slug === s)).slice(0, 3).map((s) => ({ slug: s, title: posts.find((p) => p.slug === s).title })),
    };
    const n = dayNumber(date);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${date}.json`), JSON.stringify({ n, date, type: z.type, clues: z.clues, secret: seal(secret, date) }) + "\n");
    index.push({ date, n });
    index.sort((a, b) => a.date.localeCompare(b.date));

    for (const e of [{ n: z.answer, t: z.type, ...(z.type === "model" && secret.maker ? { o: secret.maker } : {}) }, ...(z.decoys || [])]) {
      if (e.n && e.n.length <= 60 && !find(e.n, e.t)) entities.push({ n: e.n, t: e.t, ...(e.o ? { o: e.o } : {}) });
    }
    made = true;
    log(`play: AI-dle #${n} for ${date} is ready (${z.type})`);
  }
  if (made) {
    await fs.writeFile(path.join(dir, "index.json"), JSON.stringify(index.map(({ date, n }) => ({ date, n }))) + "\n");
    await fs.writeFile(entFile, JSON.stringify(entities.sort((a, b) => a.n.localeCompare(b.n))) + "\n");
  }
  return made;
}

export async function updatePlay({ root, posts, state }) {
  try { await refreshScale({ root, state }); } catch (e) { log(`play: scale refresh failed: ${e.message}`); }
  try { await ensurePuzzles({ root, posts, state }); } catch (e) { log(`play: puzzle failed: ${e.message}`); }
}
