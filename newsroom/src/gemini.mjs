// Minimal Gemini REST client: text, JSON with a schema, Google Search grounding, URL context, and images.
import { MODELS } from "./config.mjs";
import { log, sleep } from "./util.mjs";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const KEY = () => {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
};

export const usage = { calls: 0, input: 0, output: 0, images: 0, searches: 0, byModel: {} };
const missing = new Set(); // models that returned 404 this run
let schemaFieldOk = true; // flips off if the API rejects responseJsonSchema

async function call(model, body, { timeout = 180000 } = {}) {
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": KEY() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error?.message || text.slice(0, 300);
    throw Object.assign(new Error(`Gemini ${model} ${res.status}: ${msg}`), { status: res.status, msg });
  }
  const u = data.usageMetadata || {};
  usage.calls++;
  usage.input += u.promptTokenCount || 0;
  usage.output += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
  usage.byModel[model] = (usage.byModel[model] || 0) + 1;
  return data;
}

// Tries the preferred model, then fallbacks, retrying overloads with backoff.
async function generate(models, body, opts = {}) {
  const list = [...new Set(models)].filter((m) => !missing.has(m));
  let lastErr;
  for (const model of list) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return { data: await call(model, body, opts), model };
      } catch (e) {
        lastErr = e;
        if (e.status === 404 || (e.status === 400 && /not found|not supported for generateContent|unknown model/i.test(e.msg || ""))) {
          missing.add(model);
          log(`gemini: ${model} unavailable, trying next`);
          break;
        }
        if (e.status === 400 && schemaFieldOk && body.generationConfig?.responseJsonSchema && /responseJsonSchema|Unknown name|schema/i.test(e.msg || "")) {
          schemaFieldOk = false;
          throw Object.assign(e, { retrySchemaless: true });
        }
        if (e.status === 400 || e.status === 401 || e.status === 403) throw e;
        const wait = e.status === 429 ? 20000 * (attempt + 1) : 4000 * (attempt + 1);
        log(`gemini: ${model} ${e.status || e.name}, retry in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
  }
  throw lastErr || new Error("No Gemini model available");
}

const modelsFor = (primary) => [primary, ...MODELS.textFallbacks];

function textOf(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
}

function grounding(data) {
  const g = data?.candidates?.[0]?.groundingMetadata || {};
  const chunks = (g.groundingChunks || []).map((c) => c.web).filter(Boolean).map((w) => ({ uri: w.uri, title: w.title || w.domain || "" }));
  usage.searches += (g.webSearchQueries || []).length;
  const urlMeta = (data?.candidates?.[0]?.urlContextMetadata?.urlMetadata || []).map((m) => ({ url: m.retrievedUrl || m.retrieved_url, status: m.urlRetrievalStatus || m.url_retrieval_status }));
  return { chunks, queries: g.webSearchQueries || [], urlMeta };
}

export function parseJson(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(t); } catch {}
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error("Model did not return JSON");
}

function buildBody({ prompt, system, parts = [], temperature = 0.4, tools, schema, maxTokens, thinking }) {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
    generationConfig: { temperature },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (tools) body.tools = tools;
  if (maxTokens) body.generationConfig.maxOutputTokens = maxTokens;
  if (thinking) body.generationConfig.thinkingConfig = { thinkingLevel: thinking };
  if (schema) {
    body.generationConfig.responseMimeType = "application/json";
    if (schemaFieldOk) body.generationConfig.responseJsonSchema = schema;
    else body.contents[0].parts[0].text += `\n\nReturn only JSON that matches this JSON Schema:\n${JSON.stringify(schema)}`;
  }
  return body;
}

// Plain text, optionally grounded with Google Search and/or URL context.
export async function text(opts) {
  const { data, model } = await generate(modelsFor(opts.model || MODELS.writer), buildBody(opts), opts);
  return { text: textOf(data), ...grounding(data), model };
}

// JSON matching a schema. Retries once if the model returns malformed JSON.
export async function json(opts) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, model } = await generate(modelsFor(opts.model || MODELS.writer), buildBody(opts), opts);
      const raw = textOf(data);
      return { value: parseJson(raw), ...grounding(data), model };
    } catch (e) {
      if (e.retrySchemaless || (attempt === 0 && /did not return JSON|Unexpected token|JSON/.test(e.message))) {
        log("gemini: retrying JSON call", e.retrySchemaless ? "without schema field" : "after bad JSON");
        continue;
      }
      throw e;
    }
  }
  throw new Error("JSON generation failed twice");
}

// One image from Nano Banana 2 Lite (or the next configured image model). Returns a Buffer.
export async function image(prompt, { aspectRatio = "16:9" } = {}) {
  const bodies = [
    { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } } },
    { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } } },
    { contents: [{ role: "user", parts: [{ text: `${prompt}\n\nAspect ratio ${aspectRatio}.` }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } },
  ];
  let lastErr;
  for (const body of bodies) {
    try {
      const { data } = await generate(MODELS.image, body, { timeout: 150000 });
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const img = parts.filter((p) => !p.thought).map((p) => p.inlineData || p.inline_data).filter(Boolean).pop();
      if (img?.data) {
        usage.images++;
        return Buffer.from(img.data, "base64");
      }
      lastErr = new Error("Image model returned no image" + (textOf(data) ? `: ${textOf(data).slice(0, 160)}` : ""));
    } catch (e) {
      lastErr = e;
      if (e.status !== 400) break;
    }
  }
  throw lastErr;
}
