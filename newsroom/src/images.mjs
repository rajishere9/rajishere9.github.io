// Images: vet real images from the sources, generate the rest with Nano Banana, and ship everything as small WebP.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import * as gemini from "./gemini.mjs";
import { MODELS } from "./config.mjs";
import { http, pool, log, domainOf } from "./util.mjs";

const STYLE = `Editorial illustration for a premium technology news site. Cinematic and atmospheric, with a refined palette of deep aubergine and violet shadows lit by warm amber light, soft volumetric glow, fine detail, tasteful depth of field. Conceptual and symbolic rather than literal.
Strict rules: no text, letters, numbers, captions or watermarks anywhere; no company logos or brand marks; no recognisable real people or celebrity likenesses; no fake user interfaces or screenshots; no fake charts with data. Wide 16:9 composition with a clear focal point.`;

// Download images from primary sources only, drop tiny or odd-shaped ones, and ask Gemini which ones actually show this story.
// News outlets' photos and thumbnails are never used: they belong to that publisher and often carry its branding.
export async function vetRealImages(sources, story) {
  const cands = [];
  for (const s of [...sources].filter((x) => x.primary).sort((a, b) => b.official - a.official)) {
    for (const img of s.images) {
      if (!cands.some((c) => c.url === img.url)) cands.push({ ...img, sourceN: s.n, site: s.site, pageUrl: s.url, official: s.official });
    }
  }
  const downloaded = (await pool(cands.slice(0, 10), 5, async (c) => {
    const res = await http(c.url, { timeout: 20000, browser: true, headers: { referer: c.pageUrl } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 12e6) return null;
    const meta = await sharp(buf, { animated: false }).metadata();
    const ratio = meta.width / meta.height;
    if (meta.width < 600 || meta.height < 300 || ratio < 0.6 || ratio > 2.8) return null;
    return { ...c, buf, width: meta.width, height: meta.height };
  })).filter((x) => x && !x.error);
  if (!downloaded.length) { if (!cands.length) log("images: no primary-source images, using AI illustrations"); return []; }

  const thumbs = await Promise.all(downloaded.map((d) => sharp(d.buf).resize(448, 448, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer()));
  const { value } = await gemini.json({
    model: MODELS.triage,
    temperature: 0,
    prompt: `These ${downloaded.length} images were found on pages reporting this story: "${story.headline}". For each image in order, decide whether it genuinely illustrates this specific story (for example the product, model, device, research figure, people or place involved), rather than being a logo, generic stock photo, advertisement, author photo, unrelated article thumbnail, or mostly text.
Also flag any image that carries branding from a news outlet, broadcaster, podcast, newsletter or other publisher (logo, watermark, programme or bulletin title, date banner, headline overlay), or has overlaid text of any kind other than text naturally present in a product photo, diagram or chart.`,
    parts: thumbs.map((t) => ({ inlineData: { mimeType: "image/jpeg", data: t.toString("base64") } })),
    schema: {
      type: "object",
      properties: { images: { type: "array", items: { type: "object", properties: {
        index: { type: "integer" }, relevant: { type: "boolean" }, kind: { type: "string", enum: ["photo", "product", "diagram", "chart", "screenshot", "illustration", "logo", "text", "stock", "ad", "other"], description: "illustration = drawn, rendered or AI-generated artwork rather than a photo, screenshot, diagram or chart" },
        overlay: { type: "boolean", description: "True if the image has publisher branding, a watermark, or overlaid headline/banner text" },
        description: { type: "string", description: "One factual sentence describing what the image shows" },
      }, required: ["index", "relevant", "kind", "overlay", "description"] } } },
      required: ["images"],
    },
  });
  const verdicts = new Map((value.images || []).map((v) => [v.index, v]));
  const good = downloaded.map((d, i) => ({ ...d, verdict: verdicts.get(i) || verdicts.get(i + 1) }))
    // Third-party artwork isn't a "real" image of the story: only official sources' illustrations count.
    .filter((d) => d.verdict?.relevant && !d.verdict.overlay && !["logo", "text", "stock", "ad"].includes(d.verdict.kind) && (d.verdict.kind !== "illustration" || d.official))
    .map((d, i) => ({ id: `R${i + 1}`, ...d, description: d.verdict.description }));
  log(`images: ${good.length} of ${downloaded.length} source images are usable`);
  return good;
}

async function webp(buf, file, { width, height, maxBytes }) {
  const pipeline = () => {
    const img = sharp(buf).rotate();
    return height ? img.resize(width, height, { fit: "cover", position: "attention" }) : img.resize(width, null, { withoutEnlargement: true });
  };
  let out;
  for (const quality of [74, 64, 55, 46, 38]) {
    out = await pipeline().webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (out.length <= maxBytes) break;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, out);
  const meta = await sharp(out).metadata();
  return { width: meta.width, height: meta.height, bytes: out.length };
}

// Writes /blog/img/<slug>/<name>.webp (+ a small card version for the hero) and returns figure metadata.
export async function saveImage(buf, { outDir, slug, name, hero }) {
  const dir = path.join(outDir, "img", slug);
  const main = await webp(buf, path.join(dir, `${name}.webp`), hero ? { width: 1200, height: 675, maxBytes: 95e3 } : { width: 1200, maxBytes: 85e3 });
  const fig = { src: `img/${slug}/${name}.webp`, width: main.width, height: main.height, bytes: main.bytes };
  if (hero) {
    const small = await webp(buf, path.join(dir, `${name}-640.webp`), { width: 640, height: 360, maxBytes: 32e3 });
    fig.small = `img/${slug}/${name}-640.webp`;
    fig.bytes += small.bytes;
    // Social cards: JPEG at 1200x630, since not every platform previews WebP.
    const og = await sharp(buf).rotate().resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
    await fs.writeFile(path.join(dir, "og.jpg"), og);
    fig.og = `img/${slug}/og.jpg`;
  }
  return fig;
}

export async function generateImage(prompt) {
  return gemini.image(`${STYLE}\n\nScene: ${prompt}`, { aspectRatio: "16:9" });
}

// Resolve the writer's image plan into saved files. Falls back to AI when a real image fails, and vice versa.
export async function buildFigures(plan, realImages, { outDir, slug }) {
  const byId = new Map(realImages.map((r) => [r.id, r]));
  const used = new Set();
  const results = await pool(plan, 3, async (p, i) => {
    const name = p.slot === "hero" ? "hero" : `figure-${i}`;
    const hero = p.slot === "hero";
    const real = p.type === "real" && byId.get(p.realId) && !used.has(p.realId) ? byId.get(p.realId) : null;
    if (real) {
      used.add(p.realId);
      const saved = await saveImage(real.buf, { outDir, slug, name, hero });
      return { ...p, ...saved, type: "real", credit: real.site || domainOf(real.pageUrl), creditUrl: real.pageUrl };
    }
    try {
      const buf = await generateImage(p.prompt || p.alt);
      const saved = await saveImage(buf, { outDir, slug, name, hero });
      return { ...p, ...saved, type: "ai", credit: "AI-generated illustration" };
    } catch (e) {
      log(`images: generation failed for ${name}: ${e.message}`);
      const spare = realImages.find((r) => !used.has(r.id));
      if (!spare) return null;
      used.add(spare.id);
      const saved = await saveImage(spare.buf, { outDir, slug, name, hero });
      return { ...p, ...saved, type: "real", alt: spare.description, caption: spare.caption || spare.description, credit: spare.site, creditUrl: spare.pageUrl };
    }
  });
  const figs = results.filter((r) => r && !r.error);
  log(`images: ${figs.filter((f) => f.type === "real").length} real, ${figs.filter((f) => f.type === "ai").length} AI, ${Math.round(figs.reduce((n, f) => n + f.bytes, 0) / 1024)} KB total`);
  return figs;
}

export const realTarget = (total, available, share) => Math.min(available, Math.ceil(total * share));
