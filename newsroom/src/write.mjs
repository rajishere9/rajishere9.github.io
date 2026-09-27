// Writing: draft strictly from the sources, fact-check every claim against them, revise, and only then accept.
import * as gemini from "./gemini.mjs";
import { MODELS, CATEGORIES, SITE, LIMITS } from "./config.mjs";
import { normUrl, slugify, log, clip, unescapeText } from "./util.mjs";

const SYSTEM = `You are a senior technology journalist writing for ${SITE.name}, a premium news site about AI and emerging technology.
ACCURACY RULES — these override everything else:
1. Use ONLY facts that appear in the numbered SOURCES provided. Every name, number, date, benchmark, price, quote, capability and availability detail must be traceable to a source.
2. Never fill gaps from memory or prior knowledge. Your training data is outdated; the sources are the truth. If a detail isn't in the sources, leave it out. Plain, timeless definitions of well-known concepts are the only exception.
3. Attribute claims made by companies ("Google says", "according to the model card"). Benchmark and performance numbers are always attributed to whoever reported them.
4. If sources disagree, prefer the official source and mention the discrepancy.
5. Use absolute dates. Do not call anything the first, the best, the largest or the latest unless a source says so, attributed.
6. No speculation, no invented quotes, no invented reactions.
STYLE: clear, specific, confident, human. No hype and no clichés (never use: game-changer, revolutionize, landscape, delve, unleash, cutting-edge, in today's fast-paced world, it's worth noting, buckle up). American English. Short paragraphs. Explain why it matters for developers, businesses or users, grounded in the sources.
FORMAT: the body is plain Markdown. Separate paragraphs, headings and figure markers with real blank lines. Never write escape sequences such as \\n, \\t or \\" as visible characters, and never wrap the body in quotes or code fences.
IMAGES: real images come only from the organisation behind the story. AI illustrations are conceptual: their captions describe the idea they illustrate and never imply they are photos of real events, people or products.
SEO: the title leads with the key entity and what happened; the primary keyword appears in the title, the first paragraph and at least one H2. Descriptive H2 and H3 headings that match what readers search for. The meta description is a compelling 140-158 character summary.`;

const figureSchema = {
  type: "object",
  properties: {
    marker: { type: "string", description: "FIG1, FIG2 or FIG3; for the hero use HERO" },
    type: { type: "string", enum: ["real", "ai"] },
    realId: { type: "string", description: "R-id of the real image when type is real" },
    prompt: { type: "string", description: "For AI images: a vivid visual scene description (no text, logos or real people)" },
    alt: { type: "string", description: "Factual alt text describing what the image shows" },
    caption: { type: "string", description: "Short caption; for real images describe what it shows, for AI images describe the concept" },
  },
  required: ["marker", "type", "alt", "caption"],
};

const draftSchema = {
  type: "object",
  properties: {
    newsworthy: { type: "boolean", description: "False if the sources show this is old news, a rumor, or not a real event" },
    rejectReason: { type: "string" },
    title: { type: "string", description: "Headline, max 72 characters" },
    seoTitle: { type: "string", description: "Title tag, max 60 characters" },
    slug: { type: "string", description: "Short URL slug with the primary keyword, 3-8 words" },
    description: { type: "string", description: "Meta description, 140-158 characters" },
    dek: { type: "string", description: "One or two sentence standfirst under the headline" },
    category: { type: "string", enum: CATEGORIES },
    tags: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
    keyTakeaways: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
    body: { type: "string", description: "Markdown article body. Starts with the lede paragraph (no H1). Uses ## and ### headings, with blank lines between paragraphs (real line breaks, never the characters backslash-n). Contains figure markers [[FIG1]], [[FIG2]] and optionally [[FIG3]] on their own lines between sections. Cites sources with inline markdown links to their exact URLs." },
    faq: { type: "array", items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] }, minItems: 2, maxItems: 4 },
    hero: figureSchema,
    figures: { type: "array", items: figureSchema, minItems: 2, maxItems: 3 },
    sourcesUsed: { type: "array", items: { type: "integer" } },
  },
  required: ["newsworthy", "title", "seoTitle", "slug", "description", "dek", "category", "tags", "keyTakeaways", "body", "faq", "hero", "figures", "sourcesUsed"],
};

const checkSchema = {
  type: "object",
  properties: {
    claims: { type: "array", items: { type: "object", properties: {
      claim: { type: "string" },
      status: { type: "string", enum: ["supported", "unsupported", "contradicted", "outdated", "needs_attribution"] },
      source: { type: "integer", description: "Source number that supports or contradicts it, 0 if none" },
      fix: { type: "string", description: "How to correct it using only the sources, or 'remove'" },
    }, required: ["claim", "status"] } },
    recent: { type: "boolean", description: "True if the sources show the event happened or was announced recently relative to the current date" },
    score: { type: "integer", minimum: 0, maximum: 10, description: "Overall accuracy and quality" },
  },
  required: ["claims", "recent", "score"],
};

function sourcesBlock(sources) {
  return sources.map((s) => `[SOURCE ${s.n}] ${s.official ? "(OFFICIAL) " : ""}${s.site} — ${s.title}
URL: ${s.url}
Published: ${s.published ? new Date(s.published).toISOString() : "unknown"}
---
${s.text}
[END SOURCE ${s.n}]`).join("\n\n");
}

function imagesBlock(real) {
  if (!real.length) return "No usable real images were found. Use AI images for the hero and every figure.";
  return real.map((r) => `${r.id}: ${r.description} (from ${r.site}${r.official ? ", official" : ""}${r.caption ? `; original caption: ${clip(r.caption, 140)}` : ""})`).join("\n");
}

function draftText(d) {
  return `TITLE: ${d.title}
DEK: ${d.dek}
DESCRIPTION: ${d.description}
KEY TAKEAWAYS:
${d.keyTakeaways.map((t) => `- ${t}`).join("\n")}
BODY:
${d.body}
FAQ:
${d.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n")}
IMAGE CAPTIONS:
${[d.hero, ...d.figures].map((f) => `- ${f.caption}`).join("\n")}`;
}

// Normalize every text field the model wrote (escaped newlines, stray whitespace).
function tidy(d) {
  const t = (s) => unescapeText(s || "").trim();
  for (const k of ["title", "seoTitle", "slug", "description", "dek", "body"]) d[k] = t(d[k]);
  d.body = d.body.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
  d.keyTakeaways = (d.keyTakeaways || []).map(t).filter(Boolean);
  d.faq = (d.faq || []).map((f) => ({ q: t(f.q), a: t(f.a) })).filter((f) => f.q && f.a);
  for (const f of [d.hero, ...(d.figures || [])].filter(Boolean)) for (const k of ["alt", "caption", "prompt"]) if (f[k]) f[k] = t(f[k]);
  return d;
}

const problems = (check) => check.claims.filter((c) => c.status !== "supported");

const patchSchema = {
  type: "object",
  properties: {
    edits: { type: "array", items: { type: "object", properties: {
      find: { type: "string", description: "Exact text copied verbatim from the draft (a sentence or clause)" },
      replace: { type: "string", description: "Corrected text using only the sources, or an empty string to delete it" },
    }, required: ["find", "replace"] } },
  },
  required: ["edits"],
};

// Surgical fixes: rewrite only the flagged sentences so already-verified text doesn't change (and can't gain new errors).
async function patch(draft, bad, sources) {
  const { value } = await gemini.json({
    model: MODELS.writer, temperature: 0, schema: patchSchema,
    prompt: `A fact-checker flagged these claims in the draft below. For each one, give a minimal edit: copy the exact sentence or clause from the draft into "find", and put the corrected version into "replace", using only what the SOURCES say (fix the detail, add attribution such as "OpenAI says", or delete it with an empty string). Keep grammar and flow intact. Change nothing else, and never add new facts.
FLAGGED:
${bad.map((b) => `- [${b.status}] ${b.claim}${b.fix ? ` → suggested fix: ${b.fix}` : ""}`).join("\n")}

DRAFT:
${draftText(draft)}

SOURCES:
${sourcesBlock(sources)}`,
  });
  let applied = 0;
  const swap = (text) => {
    let out = text;
    for (const e of value.edits || []) {
      const find = unescapeText(e.find || ""), repl = unescapeText(e.replace || "");
      if (find && out.includes(find)) { out = out.replace(find, repl); applied++; }
    }
    return out;
  };
  draft.title = swap(draft.title);
  draft.dek = swap(draft.dek);
  draft.description = swap(draft.description);
  draft.body = swap(draft.body).replace(/ {2,}/g, " ");
  draft.keyTakeaways = draft.keyTakeaways.map(swap).filter((t) => t.trim());
  draft.faq = draft.faq.map((f) => ({ q: swap(f.q), a: swap(f.a) })).filter((f) => f.a.trim());
  for (const f of [draft.hero, ...draft.figures]) f.caption = swap(f.caption);
  tidy(draft);
  return applied;
}

async function factCheck(draft, sources) {
  const { value } = await gemini.json({
    model: MODELS.checker,
    temperature: 0,
    thinking: "high",
    schema: checkSchema,
    prompt: `Current time: ${new Date().toISOString()}.
You are a meticulous fact-checker. Check the DRAFT against the SOURCES only — not against your own knowledge, which may be outdated.
List every factual claim in the draft (names, numbers, dates, benchmarks, prices, capabilities, availability, quotes, comparisons, causal statements, superlatives), including the title, dek, takeaways, FAQ answers and captions.
Mark a claim "supported" only if a source states it. "unsupported" if no source states it. "contradicted" if a source says otherwise. "outdated" if the sources show newer information. "needs_attribution" if it presents a company's own claim as fact.
Also judge whether the event is recent relative to the current time, based on the source dates.

SOURCES:
${sourcesBlock(sources)}

DRAFT:
${draftText(draft)}`,
  });
  return value;
}

function draftPrompt(story, sources, real, extra = "") {
  const total = 3; // hero + 2 figures at minimum
  const wantReal = Math.min(real.length, Math.ceil(total * LIMITS.realImageShare));
  return `Current time: ${new Date().toISOString()}.
Write a news article about this event:
${story.headline}
${story.summary}
${story.updateOf ? `This is a follow-up to our earlier article at ${SITE.base}/${story.updateOf}/ — focus on what is new, and link to it once.` : ""}

Length: 800-1400 words if the sources are rich; shorter (600+) if they are thin. Never pad.
Structure: a strong lede paragraph (what happened, who, when, why it matters), then sections such as what's new, key details and specs, how it compares (only if the sources compare), availability and pricing (only if stated), and why it matters. End with a short, grounded outlook only if the sources support it.
Cite sources with inline markdown links to their exact URLs, at least one link per section, preferring the official source.

IMAGES: one hero plus 2 or 3 inline figures. About 40% of all images should be real images from the list below when available (use ${wantReal} or more real images if there are enough relevant ones; never reuse one), and the rest AI-generated illustrations.
Put the most striking image as the hero. Place [[FIG1]], [[FIG2]] (and [[FIG3]] if used) on their own lines where they support the text.
AI image prompts must describe a concrete, visually rich scene that conveys the story's concept, with no text, logos, UI screenshots or real people.
Available real images:
${imagesBlock(real)}

If the sources show this is old news, a rumor, or not a real event, set newsworthy to false and explain why.
${extra}
SOURCES:
${sourcesBlock(sources)}`;
}

// Keep only links that point at our sources (or our own blog), so the model can't invent URLs.
function sanitizeLinks(md, sources) {
  const allowed = new Set(sources.map((s) => normUrl(s.url)));
  return md.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    if (url.startsWith(`${SITE.base}/`) || allowed.has(normUrl(url))) return m;
    return label;
  });
}

// Make sure the planned images honour the real/AI split and reference real images that exist.
function balanceImages(draft, real) {
  const all = [draft.hero, ...draft.figures];
  const ids = new Set(real.map((r) => r.id));
  const used = new Set();
  for (const f of all) {
    if (f.type === "real" && (!ids.has(f.realId) || used.has(f.realId))) { f.type = "ai"; f.prompt ||= f.caption; }
    if (f.type === "real") used.add(f.realId);
  }
  const want = Math.min(real.length, Math.ceil(all.length * LIMITS.realImageShare));
  const spare = real.filter((r) => !used.has(r.id));
  for (const f of all.filter((x) => x.type === "ai").reverse()) {
    if (all.filter((x) => x.type === "real").length >= want || !spare.length) break;
    const r = spare.shift();
    Object.assign(f, { type: "real", realId: r.id, alt: r.description, caption: r.caption ? clip(r.caption, 160) : r.description });
  }
  draft.hero.slot = "hero";
  draft.figures.forEach((f, i) => { f.slot = `FIG${i + 1}`; f.marker = `FIG${i + 1}`; });
}

export async function writeStory(story, sources, real) {
  const t0 = Date.now();
  let { value: draft } = await gemini.json({ model: MODELS.writer, system: SYSTEM, temperature: 0.5, thinking: "medium", schema: draftSchema, prompt: draftPrompt(story, sources, real) });
  tidy(draft);
  if (!draft.newsworthy) return { rejected: draft.rejectReason || "writer judged it not newsworthy" };

  let check;
  const ROUNDS = 5;
  for (let round = 0; round < ROUNDS; round++) {
    check = await factCheck(draft, sources);
    const bad = problems(check);
    log(`write: fact-check round ${round + 1}: ${check.claims.length} claims, ${bad.length} problems, score ${check.score}`);
    if (!check.recent) return { rejected: "fact-checker: event is not recent", draft };
    if (!bad.length && check.score >= 7) break;
    if (round === ROUNDS - 1) return { rejected: `fact-check failed: ${bad.slice(0, 3).map((b) => b.claim).join(" | ")}`, draft, check };
    const applied = await patch(draft, bad, sources);
    log(`write: patched ${applied} passage(s)`);
    if (!applied) {
      // The patcher couldn't locate the text; fall back to one full rewrite with the problem list.
      ({ value: draft } = await gemini.json({
        model: MODELS.writer, system: SYSTEM, temperature: 0.3, thinking: "medium", schema: draftSchema,
        prompt: draftPrompt(story, sources, real, `A fact-checker found these problems in your previous draft. Rewrite it so every one is fixed from the sources, attributed, or removed. Keep everything else as close to the previous draft as possible and add no new claims.
PROBLEMS:
${bad.map((b) => `- [${b.status}] ${b.claim}${b.fix ? ` → ${b.fix}` : ""}`).join("\n")}

PREVIOUS DRAFT:
${draftText(draft)}
`),
      }));
      tidy(draft);
    }
  }

  draft.body = sanitizeLinks(draft.body, sources);
  if (/\\n/.test(draft.body.replace(/```[\s\S]*?```|`[^`\n]*`/g, ""))) return { rejected: "body still contains escaped newlines", draft };
  draft.slug = slugify(draft.slug || draft.title);
  draft.title = clip(draft.title, 90);
  balanceImages(draft, real);
  log(`write: accepted "${draft.title}" in ${Math.round((Date.now() - t0) / 1000)}s`);
  return { draft, check };
}
