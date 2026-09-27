// Triage: cluster raw items into stories, score importance, and match them to stories already pending or covered.
import * as gemini from "./gemini.mjs";
import { MODELS, LIMITS, CATEGORIES } from "./config.mjs";
import { hash, hoursAgo, log, domainOf, clip } from "./util.mjs";

const SYSTEM = `You are the news editor of an AI and emerging-technology news site. You decide what is genuinely important today.
Scoring rubric for "importance" (0-100):
- 90-100: a new frontier model or major product from a leading lab (OpenAI, Google/DeepMind, Anthropic, Meta, xAI, Microsoft, Apple, Nvidia, Mistral, DeepSeek, Alibaba/Qwen, Moonshot/Kimi, Zhipu/Z.ai, MiniMax, ByteDance, Tencent, Baidu); an open-weights release that sets a new state of the art; a landmark science or technology breakthrough; an industry-shaking event.
- 75-89: notable model, tool, agent or API launches; significant open-source releases (models, datasets, frameworks) from credible teams; notable audio, music, voice, image or video generation models; big funding or acquisitions (roughly $500M+); major regulation or policy moves; important research results with broad impact; major chip or robotics announcements.
- 55-74: interesting but secondary news: smaller releases, updates, partnerships, research papers with moderate impact.
- below 55: minor updates, opinion, analysis, tutorials, listicles, reviews, deals, stock moves, rumors without confirmation, community projects without traction.
Exclude anything that is not about AI, emerging tech, computing, science or space. Exclude pure opinion pieces, how-tos and promotions.
Be strict: most items are not important. Prefer items backed by official sources or multiple independent outlets.`;

const schema = {
  type: "object",
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Neutral, factual one-line description of the event" },
          summary: { type: "string", description: "Two sentences: what happened, who, and why it matters. Only facts present in the items." },
          category: { type: "string", enum: CATEGORIES },
          importance: { type: "integer", minimum: 0, maximum: 100 },
          items: { type: "array", items: { type: "integer" }, description: "Indexes of the items about this exact event" },
          pendingId: { type: "string", description: "Id of a pending story (P...) that this is the same event as, else empty" },
          coveredSlug: { type: "string", description: "Slug of an already-published post about the same event, else empty" },
          significantUpdate: { type: "boolean", description: "True only if this is a major new development on a covered event" },
        },
        required: ["headline", "summary", "category", "importance", "items"],
      },
    },
  },
  required: ["stories"],
};

function describe(it, i) {
  const age = it.publishedAt ? `${Math.max(0, Math.round(hoursAgo(it.publishedAt) * 10) / 10)}h ago` : "new";
  const flags = [it.official && "OFFICIAL", it.seedOnly && "headline-only", it.engagement].filter(Boolean).join("; ");
  return `[${i}] (${it.source}, ${domainOf(it.url)}, ${age}${flags ? `; ${flags}` : ""}) ${it.title}${it.snippet ? ` — ${clip(it.snippet, 240)}` : ""}`;
}

// Official sources and high-engagement items first, so the most useful context survives the cap.
function priority(it) {
  const eng = +(it.engagement.match(/(\d+)/)?.[1] || 0);
  return (it.official ? 1000 : 0) + (it.kind === "search" ? 300 : 0) + Math.min(800, eng) + (it.weight > 1 ? 200 : 0);
}

export async function triage(items, state) {
  const pending = state.stories.pending;
  const covered = state.stories.covered.filter((c) => hoursAgo(c.at) < 24 * 7);
  const sorted = [...items].sort((a, b) => priority(b) - priority(a)).slice(0, 360);
  const chunks = [];
  for (let i = 0; i < sorted.length; i += 120) chunks.push(sorted.slice(i, i + 120));

  const pendingText = pending.length ? pending.map((p) => `${p.id}: ${p.headline} (importance ${p.importance})`).join("\n") : "(none)";
  const coveredText = covered.length ? covered.map((c) => `${c.slug}: ${c.headline}`).join("\n") : "(none)";

  const stories = [];
  for (const chunk of chunks) {
    const { value } = await gemini.json({
      model: MODELS.triage,
      system: SYSTEM,
      temperature: 0.1,
      schema,
      prompt: `Current time: ${new Date().toISOString()}.
Group these new items into distinct news events. Several items (different outlets, Reddit, HN, Hugging Face, GitHub) can describe the same event: put them in one story. Leave out irrelevant or unimportant items entirely (don't list stories below importance 40).
If an event is already pending, set pendingId. If it was already published, set coveredSlug and significantUpdate.
Items marked headline-only have no article text yet; they can still form a story.

PENDING STORIES:
${pendingText}

ALREADY PUBLISHED (last 7 days):
${coveredText}

NEW ITEMS:
${chunk.map(describe).join("\n")}`,
    });
    for (const s of value.stories || []) {
      s.items = (s.items || []).map((i) => chunk[i]).filter(Boolean);
      if (s.items.length) stories.push(s);
    }
  }
  return stories;
}

const effective = (p) => {
  const domains = new Set(p.items.map((i) => domainOf(i.url)));
  return p.importance + Math.min(10, 3 * (domains.size - 1)) + (p.items.some((i) => i.official) ? 3 : 0);
};

// Fold triage output into the pending pool and pick what to write now.
export function mergeAndSelect(stories, state, slotsLeft) {
  const pool = state.stories.pending;
  for (const s of stories) {
    if (s.coveredSlug && !s.significantUpdate) continue;
    let p = s.pendingId && pool.find((x) => x.id === s.pendingId);
    if (!p) {
      p = { id: "P" + hash(s.headline + Date.now(), 8), headline: s.headline, firstSeen: Date.now(), items: [], attempts: 0, importance: 0 };
      pool.push(p);
    }
    Object.assign(p, {
      headline: s.importance >= p.importance ? s.headline : p.headline,
      summary: s.importance >= p.importance ? s.summary : p.summary,
      category: s.category || p.category,
      importance: Math.max(p.importance, s.importance),
      lastSeen: Date.now(),
      update: !!s.significantUpdate,
      updateOf: s.coveredSlug || p.updateOf || "",
    });
    const have = new Set(p.items.map((i) => i.id));
    for (const it of s.items) if (!have.has(it.id)) p.items.push(it);
  }
  // Drop stale or repeatedly failing stories.
  state.stories.pending = pool.filter((p) => hoursAgo(p.lastSeen || p.firstSeen) < LIMITS.pendingHours && p.attempts < 3);
  for (const p of state.stories.pending) p.score = effective(p);

  const ready = state.stories.pending
    .filter((p) => p.score >= LIMITS.publishScore && !(p.retryAfter > Date.now()))
    .sort((a, b) => b.score - a.score);
  const picked = ready.filter((p) => p.score >= LIMITS.breakingScore).concat(ready.filter((p) => p.score < LIMITS.breakingScore));
  const chosen = picked.slice(0, Math.max(0, slotsLeft));
  log(`triage: ${stories.length} stories, ${state.stories.pending.length} pending, ${ready.length} ready, writing ${chosen.length}`);
  for (const p of chosen) log(`  → [${p.score}] ${p.headline}`);
  return chosen;
}
