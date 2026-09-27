// Static site generator for /blog: index, categories, posts, feeds, sitemaps, and the home page's latest-posts strip.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Marked } from "marked";
import { SITE, CATEGORIES } from "./config.mjs";
import { esc, slugify, clip, log, unescapeText } from "./util.mjs";

const PER_PAGE = 24;
const B = SITE.base; // "/blog"
const abs = (p) => SITE.origin + p;
const catSlug = (c) => slugify(c.replace("&", "and"));

const fmtDate = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtFull = (t) => new Date(t).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC";
const iso = (t) => new Date(t).toISOString();
const time = (t, cls = "") => `<time datetime="${iso(t)}"${cls ? ` class="${cls}"` : ""} data-rel>${fmtDate(t)}</time>`;

function readingTime(md) {
  return Math.max(2, Math.round(md.split(/\s+/).length / 230));
}

async function assetVersion(file) {
  try { return crypto.createHash("md5").update(await fs.readFile(file)).digest("hex").slice(0, 8); } catch { return "0"; }
}

// Markdown with anchored headings (for the table of contents) and safe external links.
function renderMarkdown(md) {
  const toc = [];
  const used = new Set();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        let id = slugify(text.replace(/<[^>]+>/g, ""), 60) || "section";
        while (used.has(id)) id += "-x";
        used.add(id);
        if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
        const level = Math.min(Math.max(depth, 2), 4);
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.startsWith(SITE.origin);
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
      },
      image() { return ""; },
      html() { return ""; },
    },
  });
  return { html: marked.parse(unescapeText(md)), toc };
}

function figureHtml(f, { hero = false, priority = false } = {}) {
  if (!f) return "";
  const src = `${B}/${f.src}`;
  const srcset = f.small ? ` srcset="${B}/${f.small} 640w, ${src} 1200w" sizes="(max-width: 760px) 100vw, 1200px"` : "";
  const credit = f.type === "real"
    ? `<span class="credit">Image: ${f.creditUrl ? `<a href="${esc(f.creditUrl)}" target="_blank" rel="noopener">${esc(f.credit)}</a>` : esc(f.credit)}</span>`
    : `<span class="credit ai">AI-generated illustration</span>`;
  return `<figure class="${hero ? "hero-fig" : "fig"}${f.type === "ai" ? " is-ai" : ""}">
  <div class="img"><img src="${src}"${srcset} width="${f.width}" height="${f.height}" alt="${esc(f.alt)}"${priority ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></div>
  <figcaption>${f.caption ? `<span>${esc(f.caption)}</span>` : ""}${credit}</figcaption>
</figure>`;
}

function head({ title, description, canonical, image, type = "website", extra = "", css }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#16101a">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="${B}/feed.xml">
<link rel="alternate" type="application/feed+json" title="${esc(SITE.name)}" href="${B}/feed.json">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2316101a'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%23f4b860'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;1,400&family=Unbounded:wght@300;400;500&display=swap">
<link rel="stylesheet" href="${B}/blog.css?v=${css}">
${extra}
</head>`;
}

function header(current = "blog") {
  return `<a class="skip" href="#main">Skip to content</a>
<div class="backdrop" aria-hidden="true"></div>
<header class="top">
  <div class="wrap">
    <a class="mark" href="/" aria-label="rkj dev, home">rkj dev</a>
    <nav aria-label="Site">
      <a href="${B}/"${current === "blog" ? ' aria-current="page"' : ""}>Blog</a>
      <a href="/play/">Play</a>
      <a href="/#work">Work</a>
      <a href="/#about">About</a>
      <a href="/#contact">Contact</a>
    </nav>
  </div>
</header>`;
}

function footer(js) {
  return `<footer class="foot wrap">
  <div>
    <p class="foot-mark">rkj dev <span>Blog</span></p>
    <p>${esc(SITE.description)}</p>
  </div>
  <nav aria-label="Blog">
    <a href="${B}/">Latest</a>
    ${CATEGORIES.slice(0, 6).map((c) => `<a href="${B}/category/${catSlug(c)}/">${esc(c)}</a>`).join("\n    ")}
    <a href="${B}/feed.xml">RSS</a>
    <a href="/">About rkj dev</a>
  </nav>
  <p class="fine">© ${new Date().getUTCFullYear()} Rajan Krishnan. Articles are researched from the linked sources, written with AI assistance and checked claim by claim against those sources. AI-generated illustrations are labeled.</p>
</footer>
<script src="${B}/blog.js?v=${js}" defer></script>
</body>
</html>`;
}

function card(p, { size = "", priority = false } = {}) {
  const h = p.hero;
  const img = h ? `<div class="thumb${h.type === "ai" ? " is-ai" : ""}"><img src="${B}/${h.small || h.src}" ${h.small ? `srcset="${B}/${h.small} 640w, ${B}/${h.src} 1200w" sizes="${size === "lead" ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 700px) 100vw, 33vw"}"` : ""} width="640" height="360" alt="${esc(h.alt)}"${priority ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></div>` : "";
  return `<article class="card ${size}">
  <a class="card-link" href="${B}/${p.slug}/">
    ${img}
    <div class="card-body">
      <p class="meta"><span class="cat">${esc(p.category)}</span>${time(p.publishedAt)}</p>
      <h3>${esc(p.title)}</h3>
      ${size !== "compact" ? `<p class="dek">${esc(p.dek)}</p>` : ""}
      <p class="foot-meta">${p.readingTime} min read · ${p.sources.length} source${p.sources.length === 1 ? "" : "s"}</p>
    </div>
  </a>
</article>`;
}

function chips(active) {
  return `<nav class="chips" aria-label="Categories">
  <a href="${B}/"${!active ? ' aria-current="page"' : ""}>All</a>
  ${CATEGORIES.map((c) => `<a href="${B}/category/${catSlug(c)}/"${active === c ? ' aria-current="page"' : ""}>${esc(c)}</a>`).join("\n  ")}
</nav>`;
}

function pager(page, pages, baseUrl) {
  if (pages <= 1) return "";
  const url = (n) => (n === 1 ? baseUrl : `${baseUrl}page/${n}/`);
  return `<nav class="pager" aria-label="Pages">
  ${page > 1 ? `<a rel="prev" href="${url(page - 1)}">← Newer</a>` : "<span></span>"}
  <span>Page ${page} of ${pages}</span>
  ${page < pages ? `<a rel="next" href="${url(page + 1)}">Older →</a>` : "<span></span>"}
</nav>`;
}

function listingPage({ posts, page, pages, category, assets, updatedAt }) {
  const baseUrl = category ? `${B}/category/${catSlug(category)}/` : `${B}/`;
  const canonical = abs(page === 1 ? baseUrl : `${baseUrl}page/${page}/`);
  const title = category
    ? `${category} news${page > 1 ? ` (page ${page})` : ""} | ${SITE.name}`
    : page > 1 ? `Latest AI and tech news (page ${page}) | ${SITE.name}` : `AI news today: new models, open source and tech breakthroughs | ${SITE.name}`;
  const description = category ? `The latest ${category.toLowerCase()} news from ${SITE.name}: fast, source-checked coverage of what changed today.` : SITE.description;
  const [lead, second, third, ...rest] = page === 1 ? posts : [null, null, null, ...posts];
  const itemList = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: canonical, description,
    mainEntity: { "@type": "ItemList", itemListElement: posts.slice(0, 20).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`${B}/${p.slug}/`) })) } };

  return `${head({ title, description, canonical, image: posts[0]?.hero ? abs(`${B}/${posts[0].og || posts[0].hero.src}`) : `${SITE.origin}/candledeep/feature.jpg`, css: assets.css,
    extra: `<script type="application/ld+json">${JSON.stringify(itemList)}</script>${page > 1 ? `\n<link rel="prev" href="${abs(page === 2 ? baseUrl : `${baseUrl}page/${page - 1}/`)}">` : ""}${page < pages ? `\n<link rel="next" href="${abs(`${baseUrl}page/${page + 1}/`)}">` : ""}` })}
<body class="listing">
${header()}
<main id="main" class="wrap">
  <section class="masthead">
    <p class="eyebrow"><span class="live" aria-hidden="true"></span>${category ? `<a href="${B}/">Blog</a> / ${esc(category)}` : "rkj dev Blog"}<span class="updated">Updated ${time(updatedAt)}</span></p>
    <h1>${category ? esc(category) : "AI and emerging tech,<br> the day it happens."}</h1>
    <p class="intro">${category ? esc(description) : "New models, open-source releases, audio and video AI, and the science and tech breakthroughs worth knowing about. Every story is researched from its sources and checked claim by claim."}</p>
    ${chips(category)}
  </section>
  ${!posts.length ? `<p class="empty">No stories here yet. The newsroom checks for news every 30 minutes.</p>` : ""}
  ${lead ? `<section class="top-stories" aria-label="Top stories">
    ${card(lead, { size: "lead", priority: true })}
    <div class="side">${[second, third].filter(Boolean).map((p) => card(p, { size: "side" })).join("\n")}</div>
  </section>` : ""}
  ${rest.filter(Boolean).length ? `<section class="latest" aria-labelledby="latest-title">
    <h2 id="latest-title">${page === 1 ? "Latest" : `Page ${page}`}</h2>
    <div class="grid">${rest.filter(Boolean).map((p) => card(p)).join("\n")}</div>
  </section>` : ""}
  ${pager(page, pages, baseUrl)}
</main>
${footer(assets.js)}`;
}

function postPage(p, { assets, related, prev, next }) {
  const url = abs(`${B}/${p.slug}/`);
  const { html, toc } = renderMarkdown(p.body);
  const figures = Object.fromEntries(p.figures.map((f) => [f.marker, f]));
  let body = html.replace(/<p>\s*\[\[(FIG\d)\]\]\s*<\/p>/g, (_, m) => figureHtml(figures[m]) || "");
  body = body.replace(/\[\[(FIG\d)\]\]/g, "");
  // Any figure the writer forgot to place goes after the second section.
  const placed = new Set([...p.body.matchAll(/\[\[(FIG\d)\]\]/g)].map((m) => m[1]));
  const orphans = p.figures.filter((f) => !placed.has(f.marker)).map((f) => figureHtml(f)).join("\n");
  if (orphans) {
    const parts = body.split(/(?=<h2)/);
    parts.splice(Math.min(2, parts.length), 0, orphans);
    body = parts.join("");
  }

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "NewsArticle",
      headline: clip(p.title, 110), description: p.description, url, mainEntityOfPage: url,
      image: [abs(`${B}/${p.og || p.hero?.src}`), p.hero && abs(`${B}/${p.hero.src}`)].filter(Boolean),
      datePublished: iso(p.publishedAt), dateModified: iso(p.updatedAt || p.publishedAt),
      articleSection: p.category, keywords: p.tags.join(", "), wordCount: p.body.split(/\s+/).length,
      author: { "@type": "Organization", name: "rkj dev newsroom", url: abs(`${B}/`) },
      publisher: { "@type": "Organization", name: "rkj dev", url: SITE.origin, logo: { "@type": "ImageObject", url: `${SITE.origin}/me.jpg` } },
      isBasedOn: p.sources.map((s) => s.url),
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Blog", item: abs(`${B}/`) },
      { "@type": "ListItem", position: 2, name: p.category, item: abs(`${B}/category/${catSlug(p.category)}/`) },
      { "@type": "ListItem", position: 3, name: p.title, item: url },
    ] },
    p.faq?.length && { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ].filter(Boolean);

  const share = encodeURIComponent(url);
  const shareText = encodeURIComponent(p.title);
  return `${head({ title: `${p.seoTitle || p.title} | rkj dev`, description: p.description, canonical: url, image: abs(`${B}/${p.og || p.hero?.src}`), type: "article", css: assets.css,
    extra: `<meta property="article:published_time" content="${iso(p.publishedAt)}">
<meta property="article:modified_time" content="${iso(p.updatedAt || p.publishedAt)}">
<meta property="article:section" content="${esc(p.category)}">
${p.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join("\n")}
${p.hero ? `<link rel="preload" as="image" href="${B}/${p.hero.src}" imagesrcset="${p.hero.small ? `${B}/${p.hero.small} 640w, ` : ""}${B}/${p.hero.src} 1200w" imagesizes="(max-width: 760px) 100vw, 1200px">` : ""}
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` })}
<body class="post">
<div class="progress" aria-hidden="true"><span></span></div>
${header()}
<main id="main">
  <article class="article">
    <header class="post-head wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="${B}/">Blog</a><span aria-hidden="true">/</span><a href="${B}/category/${catSlug(p.category)}/">${esc(p.category)}</a></nav>
      <h1>${esc(p.title)}</h1>
      <p class="standfirst">${esc(p.dek)}</p>
      <div class="byline">
        <span class="by">rkj dev newsroom</span>
        <span>${time(p.publishedAt, "abs")}</span>
        <span>${p.readingTime} min read</span>
        <a href="#sources">${p.sources.length} source${p.sources.length === 1 ? "" : "s"}, fact-checked</a>
      </div>
    </header>
    <div class="hero-wrap wrap">${figureHtml(p.hero, { hero: true, priority: true })}</div>
    <div class="layout wrap">
      <aside class="rail" aria-label="On this page">
        ${toc.length > 2 ? `<nav class="toc"><p>On this page</p><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join("")}</ol></nav>` : ""}
        <div class="share">
          <p>Share</p>
          <a href="https://x.com/intent/post?url=${share}&text=${shareText}" target="_blank" rel="noopener">X</a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${share}" target="_blank" rel="noopener">LinkedIn</a>
          <a href="https://wa.me/?text=${shareText}%20${share}" target="_blank" rel="noopener">WhatsApp</a>
          <button type="button" data-copy="${esc(url)}">Copy link</button>
        </div>
      </aside>
      <div class="prose">
        <section class="takeaways" aria-labelledby="tk">
          <h2 id="tk">Key takeaways</h2>
          <ul>${p.keyTakeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </section>
        ${body}
        ${p.faq?.length ? `<section class="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Frequently asked questions</h2>
          ${p.faq.map((f, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n")}
        </section>` : ""}
        <section class="sources" id="sources" aria-labelledby="src-title">
          <h2 id="src-title">Sources</h2>
          <ol>${p.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.site)}</a><span>${esc(s.site)}${s.published ? ` · ${fmtDate(s.published)}` : ""}${s.official ? ' · <b class="official">Official</b>' : ""}</span></li>`).join("")}</ol>
          <p class="method">How this story was made: the newsroom picked it up from ${esc(p.foundVia || "news feeds")}, gathered the full text of the sources above, and drafted it with AI assistance. Every factual claim was then checked against those sources before publishing${p.check ? ` (${p.check.claims} claims checked)` : ""}. Illustrations marked as AI-generated are not photographs. Spotted an error? <a href="mailto:rajankrishnan909@gmail.com?subject=${encodeURIComponent("Correction: " + p.title)}">Tell us</a>.</p>
        </section>
        <p class="tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join(" ")}</p>
        <p class="stamp">Published ${fmtFull(p.publishedAt)}${p.updatedAt && p.updatedAt !== p.publishedAt ? ` · Updated ${fmtFull(p.updatedAt)}` : ""}</p>
      </div>
    </div>
  </article>
  ${related.length ? `<section class="related wrap" aria-labelledby="rel-title">
    <h2 id="rel-title">Keep reading</h2>
    <div class="grid">${related.map((r) => card(r)).join("\n")}</div>
  </section>` : ""}
  <nav class="prevnext wrap" aria-label="More stories">
    ${prev ? `<a href="${B}/${prev.slug}/"><span>Newer</span>${esc(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a class="next" href="${B}/${next.slug}/"><span>Older</span>${esc(next.title)}</a>` : "<span></span>"}
  </nav>
</main>
${footer(assets.js)}`;
}

function related(p, posts) {
  const tags = new Set(p.tags.map((t) => t.toLowerCase()));
  return posts.filter((x) => x.slug !== p.slug)
    .map((x) => ({ x, s: (x.category === p.category ? 2 : 0) + x.tags.filter((t) => tags.has(t.toLowerCase())).length * 3 - (Date.now() - x.publishedAt) / 864e5 / 7 }))
    .sort((a, b) => b.s - a.s).slice(0, 3).map((r) => r.x);
}

function rss(posts) {
  const items = posts.slice(0, 50).map((p) => `<item>
<title>${esc(p.title)}</title>
<link>${abs(`${B}/${p.slug}/`)}</link>
<guid isPermaLink="true">${abs(`${B}/${p.slug}/`)}</guid>
<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
<category>${esc(p.category)}</category>
<description>${esc(p.description)}</description>
${p.hero ? `<media:content url="${abs(`${B}/${p.og || p.hero.src}`)}" medium="image" width="1200" height="630"/>` : ""}
</item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(SITE.name)}</title>
<link>${abs(`${B}/`)}</link>
<description>${esc(SITE.description)}</description>
<language>en</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${abs(`${B}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;
}

function jsonFeed(posts) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1", title: SITE.name, home_page_url: abs(`${B}/`), feed_url: abs(`${B}/feed.json`), description: SITE.description,
    items: posts.slice(0, 50).map((p) => ({
      id: abs(`${B}/${p.slug}/`), url: abs(`${B}/${p.slug}/`), title: p.title, summary: p.dek, date_published: iso(p.publishedAt),
      image: p.hero ? abs(`${B}/${p.hero.src}`) : undefined, tags: [p.category, ...p.tags],
    })),
  }, null, 1);
}

function sitemaps(posts, categories, pagesCount) {
  const urls = [
    { loc: abs(`${B}/`), lastmod: posts[0]?.publishedAt },
    ...Array.from({ length: Math.max(0, pagesCount - 1) }, (_, i) => ({ loc: abs(`${B}/page/${i + 2}/`) })),
    ...categories.map((c) => ({ loc: abs(`${B}/category/${catSlug(c)}/`) })),
    ...posts.map((p) => ({ loc: abs(`${B}/${p.slug}/`), lastmod: p.updatedAt || p.publishedAt, image: p.hero && abs(`${B}/${p.hero.src}`) })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${iso(u.lastmod)}</lastmod>` : ""}${u.image ? `<image:image><image:loc>${esc(u.image)}</image:loc></image:image>` : ""}</url>`).join("\n")}
</urlset>`;
  const recent = posts.filter((p) => Date.now() - p.publishedAt < 2 * 864e5);
  const news = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recent.map((p) => `<url><loc>${abs(`${B}/${p.slug}/`)}</loc><news:news><news:publication><news:name>rkj dev</news:name><news:language>en</news:language></news:publication><news:publication_date>${iso(p.publishedAt)}</news:publication_date><news:title>${esc(p.title)}</news:title></news:news></url>`).join("\n")}
</urlset>`;
  return { sitemap, news };
}

// The home page shows the three newest stories between these markers.
async function updateHome(root, posts) {
  const file = path.join(root, "index.html");
  let html;
  try { html = await fs.readFile(file, "utf8"); } catch { return; }
  const start = "<!-- blog:latest -->", end = "<!-- /blog:latest -->";
  if (!html.includes(start)) return;
  const cards = posts.slice(0, 3).map((p) => `<a class="post-card" href="${B}/${p.slug}/">
            ${p.hero ? `<img src="${B}/${p.hero.small || p.hero.src}" width="640" height="360" alt="${esc(p.hero.alt)}" loading="lazy" decoding="async">` : ""}
            <span class="post-meta">${esc(p.category)} · <time datetime="${iso(p.publishedAt)}">${fmtDate(p.publishedAt)}</time></span>
            <span class="post-title">${esc(p.title)}</span>
          </a>`).join("\n          ");
  const block = posts.length ? `${start}
          ${cards}
          ${end}` : `${start}\n          <p class="post-empty">The first stories are on their way.</p>\n          ${end}`;
  const next = html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  if (next !== html) await fs.writeFile(file, next);
}

export async function renderSite({ root, posts }) {
  const out = path.join(root, "blog");
  posts = posts.filter((p) => !p.hidden).sort((a, b) => b.publishedAt - a.publishedAt);
  for (const p of posts) p.readingTime = readingTime(p.body);
  const assets = { css: await assetVersion(path.join(out, "blog.css")), js: await assetVersion(path.join(out, "blog.js")) };
  const updatedAt = posts[0]?.publishedAt || Date.now(); // stable output: pages only change when posts do

  // Regenerate listing trees from scratch so removed posts and old pages disappear.
  await fs.rm(path.join(out, "page"), { recursive: true, force: true });
  await fs.rm(path.join(out, "category"), { recursive: true, force: true });
  const write = async (rel, content) => {
    const file = path.join(out, rel);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  };

  const pages = Math.max(1, Math.ceil(posts.length / PER_PAGE));
  for (let page = 1; page <= pages; page++) {
    const html = listingPage({ posts: posts.slice((page - 1) * PER_PAGE, page * PER_PAGE), page, pages, assets, updatedAt });
    await write(page === 1 ? "index.html" : `page/${page}/index.html`, html);
  }
  const usedCats = CATEGORIES;
  for (const c of usedCats) {
    const list = posts.filter((p) => p.category === c);
    const cp = Math.max(1, Math.ceil(list.length / PER_PAGE));
    for (let page = 1; page <= cp; page++) {
      await write(`category/${catSlug(c)}/${page === 1 ? "" : `page/${page}/`}index.html`, listingPage({ posts: list.slice((page - 1) * PER_PAGE, page * PER_PAGE), page, pages: cp, category: c, assets, updatedAt }));
    }
  }
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    await write(`${p.slug}/index.html`, postPage(p, { assets, related: related(p, posts), prev: posts[i - 1], next: posts[i + 1] }));
  }
  const { sitemap, news } = sitemaps(posts, usedCats, pages);
  await write("feed.xml", rss(posts));
  await write("feed.json", jsonFeed(posts));
  await write("sitemap.xml", sitemap);
  await write("news-sitemap.xml", news);
  await updateHome(root, posts);
  log(`render: ${posts.length} posts, ${pages} index pages`);
}
