// Small shared helpers: HTTP with timeouts and retries, concurrency, hashing, text and dates.
import crypto from "node:crypto";

export const UA_BOT = "Mozilla/5.0 (compatible; rkjdev-newsroom/1.0; +https://www.rkjdev.com/blog/)";
export const UA_BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

// fetch with a timeout, a browser-like fallback user agent, and retries for flaky upstreams.
export async function http(url, { timeout = 20000, retries = 1, headers = {}, browser = false, ...opts } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        ...opts,
        headers: { "user-agent": browser ? UA_BROWSER : UA_BOT, accept: "*/*", "accept-language": "en-US,en;q=0.9", ...headers },
        signal: AbortSignal.timeout(timeout),
      });
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return res;
    } catch (e) {
      last = e;
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    }
  }
  throw last;
}

export async function httpText(url, opts) {
  const res = await http(url, opts);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { status: res.status });
  return res.text();
}

export async function httpJson(url, opts) {
  const res = await http(url, opts);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { status: res.status });
  return res.json();
}

// Run fn over items with at most n in flight.
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: e }; }
    }
  }));
  return out;
}

export const hash = (s, n = 16) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, n);

// Canonical form of a URL for de-duplication: no tracking params, no fragment, no trailing slash.
export function normUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_src$|fbclid$|gclid$|mc_|igshid$|s$|smid$|cmpid$)/i.test(k)) url.searchParams.delete(k);
    }
    url.hostname = url.hostname.replace(/^www\./, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(u || "").trim();
  }
}

export const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

export function slugify(s, max = 72) {
  return String(s).toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, max).replace(/-[^-]*$/, (m) => (m.length < 4 ? "" : m)).replace(/-+$/, "");
}

export function stripHtml(s = "") {
  return String(s).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/\s+/g, " ").trim();
}

// Models sometimes double-escape JSON strings, leaving literal "\n" or "\"" in the text. Undo that outside code spans.
export const unescapeText = (s) => typeof s !== "string" || !/\\[ntr"]/.test(s) ? s : s.split(/(```[\s\S]*?```|`[^`\n]*`)/).map((part, i) => i % 2 ? part
  : part.replace(/\\r\\n|\\n/g, "\n").replace(/\\t/g, " ").replace(/\\r/g, "").replace(/\\"/g, '"')).join("");

export const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");

export function parseDate(v) {
  if (!v) return null;
  const t = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(t) && t > 0 ? t : null;
}

export const hoursAgo = (t) => (Date.now() - t) / 36e5;

export const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const today = () => new Date().toISOString().slice(0, 10);

// Google Search grounding hands back redirect links; follow them to the publisher's real URL.
export async function resolveRedirect(u) {
  if (!/vertexaisearch\.cloud\.google\.com|grounding-api-redirect/.test(u || "")) return u;
  try {
    const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    return res.headers.get("location") || null;
  } catch {
    return null;
  }
}
