// Research: turn a story into full-text, dated sources. Nothing gets written from headlines alone.
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import * as gemini from "./gemini.mjs";
import { MODELS, LIMITS, REPUTABLE_DOMAINS, BLOCKED_DOMAINS } from "./config.mjs";
import { http, httpText, pool, normUrl, domainOf, parseDate, hoursAgo, log, clip, stripHtml, resolveRedirect } from "./util.mjs";
import { isOfficialUrl } from "./collect.mjs";

const MAX_SOURCES = 7;
const matches = (d, list) => list.some((x) => d === x || d.endsWith("." + x));
const MAX_CHARS = 14000;
const INSTITUTIONAL = /\.(edu|gov|mil|int)(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|\.gov\.[a-z]{2}$/;
const NOT_SOURCES = /(^|\.)(news\.google\.com|reddit\.com|redd\.it|news\.ycombinator\.com|bsky\.app|x\.com|twitter\.com|t\.co|lobste\.rs|techmeme\.com|producthunt\.com|youtube\.com|youtu\.be|facebook\.com|instagram\.com|linkedin\.com)$/;

function metaContent(doc, ...names) {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`);
    if (el?.getAttribute("content")) return el.getAttribute("content").trim();
  }
  return "";
}

function jsonLdDate(doc) {
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const m = s.textContent.match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return "";
}

function absolute(src, base) {
  try { return new URL(src, base).toString(); } catch { return null; }
}

const BAD_IMG = /\.svg|\.gif|logo|icon|avatar|sprite|favicon|pixel|spacer|badge|emoji|placeholder|author|headshot|profile|gravatar|doubleclick|ads?\.|\/ads\/|tracking|1x1|blank\./i;

function pickSrc(img, base) {
  const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
  if (srcset) {
    const best = srcset.split(",").map((s) => s.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w) || 0 })).sort((a, b) => b.w - a.w)[0];
    if (best?.u) return absolute(best.u, base);
  }
  const src = img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("src");
  return src && !src.startsWith("data:") ? absolute(src, base) : null;
}

// Download and extract one page: readable text, title, publisher, publish date, and candidate images.
async function extract(url) {
  const res = await http(url, { timeout: 25000, browser: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const finalUrl = res.url || url;
  const type = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (/text\/plain|markdown/.test(type)) return { url: finalUrl, text: raw.slice(0, MAX_CHARS), title: "", site: domainOf(finalUrl), published: null, images: [] };

  const { document } = parseHTML(raw);
  const published = parseDate(metaContent(document, "article:published_time", "og:article:published_time", "datePublished", "pubdate", "publish-date", "date", "parsely-pub-date", "sailthru.date")
    || jsonLdDate(document) || document.querySelector("time[datetime]")?.getAttribute("datetime"));
  const site = metaContent(document, "og:site_name", "application-name") || domainOf(finalUrl);
  const ogImage = absolute(metaContent(document, "og:image", "og:image:url", "twitter:image", "twitter:image:src"), finalUrl);
  const ogAlt = metaContent(document, "og:image:alt", "twitter:image:alt");

  const images = [];
  if (ogImage && !BAD_IMG.test(ogImage)) images.push({ url: ogImage, alt: ogAlt, caption: "", og: true });
  for (const img of document.querySelectorAll("article img, main img, figure img, .post img, .content img")) {
    const src = pickSrc(img, finalUrl);
    if (!src || BAD_IMG.test(src)) continue;
    const w = parseInt(img.getAttribute("width") || "0");
    if (w && w < 500) continue;
    const caption = stripHtml(img.closest("figure")?.querySelector("figcaption")?.innerHTML || "");
    images.push({ url: src, alt: img.getAttribute("alt") || "", caption });
    if (images.length >= 8) break;
  }

  const article = new Readability(document, { charThreshold: 300 }).parse();
  const text = (article?.textContent || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return {
    url: finalUrl,
    title: article?.title || document.title || "",
    site: article?.siteName || site,
    published: published || parseDate(article?.publishedTime),
    text: text.slice(0, MAX_CHARS),
    images: images.filter((v, i, a) => a.findIndex((x) => x.url === v.url) === i),
  };
}

// Model cards and READMEs carry the real release details for Hugging Face and GitHub launches.
async function extractSpecial(url) {
  const hf = url.match(/^https:\/\/huggingface\.co\/([^/]+\/[^/?#]+)$/);
  if (hf && !/^(papers|spaces|datasets|blog)\//.test(hf[1])) {
    const [card, api] = await Promise.all([
      httpText(`https://huggingface.co/${hf[1]}/raw/main/README.md`).catch(() => ""),
      http(`https://huggingface.co/api/models/${hf[1]}`).then((r) => r.json()).catch(() => ({})),
    ]);
    if (card.length > 300) return { url, title: hf[1], site: "Hugging Face", published: parseDate(api.createdAt), text: card.replace(/^---[\s\S]*?---/, "").slice(0, MAX_CHARS), images: [] };
  }
  const gh = url.match(/^https:\/\/github\.com\/([^/]+\/[^/?#]+)\/?$/);
  if (gh) {
    const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const [readme, repo] = await Promise.all([
      httpText(`https://raw.githubusercontent.com/${gh[1]}/HEAD/README.md`).catch(() => ""),
      http(`https://api.github.com/repos/${gh[1]}`, { headers }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (readme.length > 300) return { url, title: repo.full_name || gh[1], site: "GitHub", published: parseDate(repo.created_at), text: `${repo.description || ""}\n\n${readme}`.slice(0, MAX_CHARS), images: [] };
  }
  return null;
}

// For pages that block scrapers or render with JavaScript, let Gemini read the page itself.
async function viaUrlContext(url) {
  const { text, urlMeta } = await gemini.text({
    model: MODELS.writer,
    tools: [{ url_context: {} }],
    temperature: 0,
    prompt: `Read this page: ${url}
Return its complete factual content as plain text: every fact, number, name, date, quote, benchmark, price, availability detail and limitation it states. Do not summarise away details, and do not add anything that is not on the page.
First line: "PUBLISHED: <the page's publish date in ISO format, or unknown>". Second line: "TITLE: <page title>". Then the content.
If the page cannot be read, reply exactly: UNREADABLE`,
  });
  if (!text || /^UNREADABLE/.test(text.trim()) || urlMeta.some((m) => /ERROR|FAIL|UNSAFE/i.test(m.status || ""))) return null;
  const published = parseDate((text.match(/^PUBLISHED:\s*(\S+)/m) || [])[1]);
  const title = (text.match(/^TITLE:\s*(.+)$/m) || [])[1] || "";
  return { url, title, site: domainOf(url), published, text: text.replace(/^(PUBLISHED|TITLE):.*$/gm, "").trim().slice(0, MAX_CHARS), images: [], viaGemini: true };
}

// Ask Google Search (through Gemini) for the official announcement and reputable coverage.
async function findSources(story) {
  const { value, chunks } = await gemini.json({
    model: MODELS.writer,
    tools: [{ google_search: {} }],
    temperature: 0,
    prompt: `Current time: ${new Date().toISOString()}.
News event: ${story.headline}
Context: ${story.summary}
Search for this exact event. Return the URL of the official announcement or primary source (the organisation's own blog, model card, paper, press release, repository or institutional news page; never a news outlet) if one exists, plus up to 4 reputable independent news reports about it. Only return URLs that appear in your search results, and prefer the most recent reporting. Note each page's publish date if shown.`,
    schema: {
      type: "object",
      properties: {
        official: { type: "array", items: { type: "object", properties: { url: { type: "string" }, published: { type: "string" } }, required: ["url"] } },
        coverage: { type: "array", items: { type: "object", properties: { url: { type: "string" }, published: { type: "string" } }, required: ["url"] } },
        eventDate: { type: "string", description: "ISO date the event happened or was announced, if known" },
      },
      required: ["official", "coverage"],
    },
  });
  const web = (list) => (list || []).map((x) => x.url).filter((u) => /^https?:\/\//.test(u || ""));
  const official = (await Promise.all(web(value.official).map(resolveRedirect))).filter(Boolean);
  const urls = await Promise.all([...web(value.coverage), ...chunks.slice(0, 8).map((c) => c.uri)].map(resolveRedirect));
  return { urls: [...official, ...urls.filter(Boolean)], official, eventDate: parseDate(value.eventDate) };
}

export async function research(story) {
  const candidates = [];
  const add = (u) => {
    if (!u || NOT_SOURCES.test(domainOf(u)) || matches(domainOf(u), BLOCKED_DOMAINS)) return;
    if (!candidates.some((c) => normUrl(c) === normUrl(u))) candidates.push(u);
  };
  story.items.filter((i) => i.official).forEach((i) => add(i.url));
  let eventDate = null;
  const primaryDomains = new Set();
  try {
    const found = await findSources(story);
    found.urls.forEach(add);
    found.official.map(domainOf).filter((d) => !matches(d, REPUTABLE_DOMAINS)).forEach((d) => primaryDomains.add(d));
    eventDate = found.eventDate;
  } catch (e) {
    log(`research: search failed: ${e.message}`);
  }
  story.items.filter((i) => !i.official && !i.seedOnly).forEach((i) => add(i.url));

  // Official first, then reputable outlets, then everything else; at most two pages per publisher.
  const rank = (u) => (isOfficialUrl(u) ? 2 : matches(domainOf(u), REPUTABLE_DOMAINS) ? 1 : 0);
  const perDomain = {};
  const ordered = candidates.sort((a, b) => rank(b) - rank(a)).filter((u) => (perDomain[domainOf(u)] = (perDomain[domainOf(u)] || 0) + 1) <= 2).slice(0, 10);

  let fallbacks = 0;
  const pages = await pool(ordered, 4, async (url) => {
    let page = await extractSpecial(url).catch(() => null);
    if (!page) page = await extract(url).catch((e) => ({ url, error: e.message, text: "" }));
    if ((page.text || "").length < 700 && fallbacks < 3) {
      fallbacks++;
      const viaAi = await viaUrlContext(url).catch(() => null);
      if (viaAi && viaAi.text.length > (page.text || "").length) page = { ...viaAi, images: page.images || [], published: page.published || viaAi.published };
    }
    return page;
  });

  // Primary = the organisation behind the story (lab, company, university, agency), never a news outlet.
  // Only primary pages may supply "real" images, so we never republish another publisher's photos or thumbnails.
  const isPrimary = (u) => isOfficialUrl(u) || primaryDomains.has(domainOf(u)) || INSTITUTIONAL.test(domainOf(u));
  const seenText = new Set();
  const sources = pages
    .filter((p) => p && !p.error && (p.text || "").length >= 400)
    .filter((p) => { const k = p.text.slice(0, 300); if (seenText.has(k)) return false; seenText.add(k); return true; })
    .sort((a, b) => rank(b.url) - rank(a.url))
    .slice(0, MAX_SOURCES)
    .map((p, i) => ({ n: i + 1, url: p.url, title: clip(p.title, 200), site: p.site, official: isOfficialUrl(p.url), primary: isPrimary(p.url), published: p.published || null, text: p.text, images: p.images || [] }));

  const totalChars = sources.reduce((n, s) => n + s.text.length, 0);
  const dated = sources.filter((s) => s.published).map((s) => s.published);
  const newest = dated.length ? Math.max(...dated) : null;
  const itemsNewest = Math.max(0, ...story.items.map((i) => i.publishedAt || 0));

  // Gate: enough real text, and evidence the event is recent (not an old story resurfacing).
  let reject = "";
  if (!sources.length) reject = "no readable sources";
  else if (totalChars < LIMITS.minSourceChars) reject = `only ${totalChars} chars of source text`;
  else if (newest && hoursAgo(newest) > LIMITS.sourceMaxAgeHours && !(eventDate && hoursAgo(eventDate) < LIMITS.sourceMaxAgeHours)) reject = `newest source is ${Math.round(hoursAgo(newest))}h old`;
  else if (!newest && !(eventDate && hoursAgo(eventDate) < LIMITS.sourceMaxAgeHours) && !(itemsNewest && hoursAgo(itemsNewest) < 48 && sources.some((s) => s.official))) reject = "could not confirm the event is recent";

  log(`research: ${sources.length} sources, ${totalChars} chars${reject ? ` — rejected: ${reject}` : ""}`);
  return { sources, eventDate, reject };
}
