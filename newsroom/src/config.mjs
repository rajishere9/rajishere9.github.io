// Everything tunable about the newsroom lives here: models, limits, and the sources it watches.

export const SITE = {
  origin: "https://www.rkjdev.com",
  base: "/blog",
  name: "rkj dev Blog",
  owner: "Rajan Krishnan",
  tagline: "AI and emerging tech, the day it happens.",
  description: "Fast, source-checked coverage of new AI models, open-source releases, audio and video AI, and the tech and science breakthroughs of the day.",
};

export const MODELS = {
  // Cheap and fast: clustering and scoring hundreds of headlines, checking images.
  triage: process.env.MODEL_TRIAGE || "gemini-3.5-flash-lite",
  // Research with Google Search grounding, writing and fact-checking.
  writer: process.env.MODEL_WRITER || "gemini-3.8-flash",
  checker: process.env.MODEL_CHECKER || "gemini-3.8-flash",
  // Nano Banana 2 Lite first, Nano Banana 2 if Lite is unavailable.
  image: (process.env.MODEL_IMAGE || "gemini-3.1-flash-lite-image,gemini-3.1-flash-image").split(","),
  // Tried in order if a configured text model is missing or overloaded.
  textFallbacks: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
};

export const LIMITS = {
  postsPerDay: +(process.env.POSTS_PER_DAY || 10),
  postsPerRun: +(process.env.POSTS_PER_RUN || 3),
  publishScore: +(process.env.PUBLISH_SCORE || 72), // triage importance needed to write a story
  breakingScore: 88, // written first, even when the run is busy
  pendingHours: 18, // how long a not-yet-important story waits for corroboration
  itemMaxAgeHours: 14, // ignore feed items older than this (first run: 24)
  sourceMaxAgeHours: 96, // a story's primary source must be at least this fresh
  minSourceChars: 2500, // total full-text source material required before writing
  sweepEveryMinutes: +(process.env.SWEEP_EVERY_MINUTES || 120), // Gemini + Google Search sweep for anything the feeds missed
  realImageShare: 0.4,
  runBudgetMinutes: 22,
};

export const CATEGORIES = [
  "AI Models", "Open Source", "Research", "Audio & Video", "Agents & Tools", "Industry",
  "Policy", "Chips & Hardware", "Robotics", "Science", "Space", "Tech",
];

// Domains whose images and words count as official, first-party sources.
export const OFFICIAL_DOMAINS = [
  "openai.com", "anthropic.com", "deepmind.google", "blog.google", "research.google", "developers.googleblog.com", "ai.google.dev",
  "ai.meta.com", "about.fb.com", "mistral.ai", "x.ai", "deepseek.com", "api-docs.deepseek.com", "qwenlm.github.io", "qwen.ai",
  "alibabacloud.com", "moonshot.ai", "kimi.ai", "z.ai", "zhipuai.cn", "minimax.io", "minimaxi.com", "cohere.com", "stability.ai",
  "runwayml.com", "elevenlabs.io", "midjourney.com", "bfl.ai", "suno.com", "machinelearning.apple.com", "apple.com",
  "microsoft.com", "news.microsoft.com", "blogs.microsoft.com", "nvidia.com", "blogs.nvidia.com", "developer.nvidia.com",
  "aws.amazon.com", "aboutamazon.com", "huggingface.co", "together.ai", "allenai.org", "lumalabs.ai", "ollama.com",
  "seed.bytedance.com", "bytedance.com", "tencent.com", "hunyuan.tencent.com", "baidu.com", "stepfun.com", "github.com",
  "github.blog", "arxiv.org", "nature.com", "science.org", "nasa.gov", "esa.int", "spacex.com", "perplexity.ai", "ibm.com",
  "amd.com", "intel.com", "qualcomm.com", "samsung.com", "sakana.ai", "liquid.ai", "ai21.com", "character.ai", "pika.art",
  "kling.ai", "klingai.com", "hailuoai.video", "ideogram.ai", "krea.ai", "sesame.com", "kyutai.org", "cartesia.ai",
];

const rss = (id, url, extra = {}) => ({ id, type: "rss", url, ...extra });
const links = (id, url, pattern, extra = {}) => ({ id, type: "links", url, pattern, ...extra });

// Official lab and company newsrooms. Undated link lists are baselined on first sight, so only new links count.
export const LAB_SOURCES = [
  rss("openai", "https://openai.com/news/rss.xml", { official: true }),
  rss("deepmind", "https://deepmind.google/blog/rss.xml", { official: true }),
  rss("google-ai", "https://blog.google/technology/ai/rss/", { official: true }),
  rss("google-research", "https://research.google/blog/rss/", { official: true }),
  rss("google-devs", "https://developers.googleblog.com/feeds/posts/default", { official: true }),
  links("anthropic", "https://www.anthropic.com/news", "^/news/[a-z0-9-]+$", { official: true }),
  rss("mistral", "https://mistral.ai/news/rss", { official: true }),
  links("deepseek", "https://api-docs.deepseek.com/", "^/news/news\\d+", { official: true }),
  rss("qwen", "https://qwenlm.github.io/blog/index.xml", { official: true }),
  links("minimax", "https://www.minimax.io/news", "^/news/[a-z0-9-]+", { official: true }),
  links("cohere", "https://cohere.com/blog", "^/blog/(?!tag/|category/)[a-z0-9-]+$", { official: true }),
  links("runway", "https://runwayml.com/news", "^/news/research/[a-z0-9-]+|^/news/(?!customers|research$)[a-z0-9-]+$", { official: true }),
  links("elevenlabs", "https://elevenlabs.io/blog", "^/blog/(?!category/)[a-z0-9-]+$", { official: true }),
  rss("midjourney", "https://updates.midjourney.com/rss/", { official: true }),
  links("bfl", "https://bfl.ai/blog", "^/blog/[a-z0-9-]+$", { official: true }),
  links("suno", "https://suno.com/blog", "^/blog/[a-z0-9-]+$", { official: true }),
  links("luma", "https://lumalabs.ai/blog", "^/news/[a-z0-9-]+$", { official: true }),
  links("ai2", "https://allenai.org/blog", "^/blog/[a-z0-9-]+$", { official: true }),
  rss("together", "https://www.together.ai/blog/rss.xml", { official: true }),
  rss("ollama", "https://ollama.com/blog/rss.xml", { official: true }),
  rss("apple-ml", "https://machinelearning.apple.com/rss.xml", { official: true }),
  rss("microsoft", "https://news.microsoft.com/source/feed/", { official: true, aiOnly: true }),
  rss("nvidia", "https://blogs.nvidia.com/feed/", { official: true }),
  rss("nvidia-dev", "https://developer.nvidia.com/blog/feed", { official: true, aiOnly: true }),
  rss("aws-ml", "https://aws.amazon.com/blogs/machine-learning/feed/", { official: true }),
  rss("huggingface-blog", "https://huggingface.co/blog/feed.xml", { official: true }),
  rss("github-blog", "https://github.blog/feed/", { official: true, aiOnly: true }),
  rss("cloudflare-blog", "https://blog.cloudflare.com/rss/", { official: true, aiOnly: true }),
];

// News outlets and newsletters, including China-focused ones.
export const NEWS_SOURCES = [
  rss("techmeme", "https://www.techmeme.com/feed.xml", { weight: 1.3 }),
  rss("techcrunch-ai", "https://techcrunch.com/category/artificial-intelligence/feed/"),
  rss("verge-ai", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
  rss("ars-tech", "https://feeds.arstechnica.com/arstechnica/technology-lab"),
  rss("ars-science", "https://arstechnica.com/science/feed/"),
  rss("mit-tr-ai", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
  rss("wired-ai", "https://www.wired.com/feed/tag/ai/latest/rss"),
  rss("the-decoder", "https://the-decoder.com/feed/"),
  rss("siliconangle-ai", "https://siliconangle.com/category/ai/feed/"),
  rss("register-ai", "https://www.theregister.com/software/ai_ml/headlines.atom"),
  rss("engadget", "https://www.engadget.com/rss.xml", { aiOnly: true }),
  rss("9to5google", "https://9to5google.com/feed/", { aiOnly: true }),
  rss("9to5mac", "https://9to5mac.com/feed/", { aiOnly: true }),
  rss("tomshardware", "https://www.tomshardware.com/feeds/all", { aiOnly: true }),
  rss("ieee-spectrum", "https://spectrum.ieee.org/feeds/feed.rss"),
  rss("restofworld", "https://restofworld.org/feed/latest/", { aiOnly: true }),
  rss("scmp-tech", "https://www.scmp.com/rss/36/feed"),
  rss("pandaily", "https://pandaily.com/feed/"),
  rss("technode", "https://technode.com/feed/", { maxItems: 40 }),
  rss("simonwillison", "https://simonwillison.net/atom/everything/", { weight: 1.2 }),
  rss("importai", "https://importai.substack.com/feed"),
  rss("interconnects", "https://www.interconnects.ai/feed"),
  rss("latent-space", "https://www.latent.space/feed"),
  rss("bensbites", "https://www.bensbites.com/feed"),
  rss("semianalysis", "https://www.semianalysis.com/feed"),
  rss("chinatalk", "https://www.chinatalk.media/feed"),
  rss("producthunt-ai", "https://www.producthunt.com/feed?category=artificial-intelligence", { maxItems: 15 }),
  rss("lobsters-ai", "https://lobste.rs/t/ai.rss"),
  // Science and space
  rss("nature", "https://www.nature.com/nature.rss", { science: true, maxItems: 30 }),
  rss("science", "https://www.science.org/rss/news_current.xml", { science: true }),
  rss("sciencedaily-tech", "https://www.sciencedaily.com/rss/top/technology.xml", { science: true, maxItems: 30 }),
  rss("phys-org", "https://phys.org/rss-feed/breaking/", { science: true }),
  rss("quanta", "https://www.quantamagazine.org/feed/", { science: true }),
  rss("nasa", "https://www.nasa.gov/news-release/feed/", { science: true, official: true }),
  // Google News searches catch outlets without feeds. Links are Google redirects, so these only seed stories.
  ...[
    "AI model release OR launches new model",
    "open-source AI model OR open weights",
    "OpenAI OR Anthropic OR \"Google DeepMind\" OR Gemini announces",
    "DeepSeek OR Qwen OR Kimi OR Zhipu OR MiniMax OR Baidu ERNIE OR Hunyuan AI",
    "AI video generator OR text-to-video OR AI music OR text-to-speech model",
    "AI chip OR Nvidia OR TPU announcement",
    "scientific breakthrough OR scientists discover",
    "humanoid robot OR robotics breakthrough",
  ].map((q, i) => rss(`gnews-${i}`, `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=en-US&gl=US&ceid=US:en`, { seedOnly: true, maxItems: 25 })),
];

// Hugging Face organisations: model uploads here are often the first sign of a release, especially from Chinese labs.
export const HF_ORGS = [
  "openai", "google", "meta-llama", "facebook", "microsoft", "nvidia", "mistralai", "Qwen", "deepseek-ai", "moonshotai",
  "zai-org", "THUDM", "MiniMaxAI", "tencent", "ByteDance-Seed", "bytedance-research", "stepfun-ai", "baidu", "internlm",
  "OpenGVLab", "xai-org", "apple", "ibm-granite", "allenai", "CohereLabs", "black-forest-labs", "stabilityai", "Lightricks",
  "Wan-AI", "tencent-hunyuan", "inclusionAI", "XiaomiMiMo", "meituan-longcat", "rednote-hilab", "openbmb", "Kwai-Kolors",
  "KwaiVGI", "LiquidAI", "ai21labs", "NousResearch", "HuggingFaceTB", "Salesforce", "amazon", "sesame", "kyutai",
  "nari-labs", "ResembleAI", "hexgrad", "SWivid", "fishaudio", "microsoft-research", "PrimeIntellect", "arcee-ai",
  "ServiceNow-AI", "01-ai", "Skywork", "baichuan-inc", "SakanaAI", "genmo", "rhymes-ai", "lmms-lab", "Alibaba-NLP",
];

// GitHub organisations whose new repositories signal launches (code drops, open weights, tools).
export const GH_ORGS = [
  "openai", "anthropics", "google-deepmind", "google-gemini", "google-research", "facebookresearch", "meta-llama", "microsoft",
  "NVIDIA", "deepseek-ai", "QwenLM", "MoonshotAI", "zai-org", "THUDM", "MiniMax-AI", "Tencent-Hunyuan", "ByteDance-Seed",
  "bytedance", "stepfun-ai", "mistralai", "huggingface", "apple", "xai-org", "allenai", "black-forest-labs", "Stability-AI",
  "Wan-Video", "OpenBMB", "InternLM", "OpenGVLab", "XiaomiMiMo", "meituan-longcat", "inclusionAI", "SakanaAI",
];

// Fetched as three combined "top of the day" feeds, so big general subreddits don't drown out the AI ones.
export const REDDIT_GROUPS = [
  ["LocalLLaMA", "MachineLearning", "OpenAI", "ClaudeAI", "GoogleGeminiAI", "DeepSeek", "Qwen_AI", "LLMDevs", "mlscaling"],
  ["singularity", "artificial", "StableDiffusion", "aivideo", "comfyui", "robotics", "accelerate"],
  ["technology", "science", "Futurology", "space", "hardware"],
];

export const BLUESKY_QUERIES = [
  "new model released", "open weights", "open-source model", "LLM benchmark", "text-to-video", "text-to-speech model",
  "AI announcement", "Hugging Face release", "breakthrough study",
];

// Words that make a general-news item worth sending to triage (for aiOnly feeds and pre-filtering).
export const TOPIC_RE = /\b(ai|a\.i\.|artificial intelligence|llm|gpt|gemini|claude|llama|model|models|open[- ]?source|open weights|neural|machine learning|deep learning|agent|agents|chatbot|copilot|openai|anthropic|deepmind|nvidia|gpu|tpu|chip|robot|robotics|humanoid|quantum|fusion|breakthrough|diffusion|transformer|benchmark|reasoning|multimodal|text-to-|voice|speech|video generat|image generat|deepseek|qwen|kimi|mistral|hugging ?face|xai|grok|meta ai|perplexity|midjourney|runway|sora|veo|suno|elevenlabs|autonomous|self-driving|semiconductor|dataset|arxiv|paper)\b/i;

// Independent outlets we trust for facts, ranked after official sources when choosing what to read.
export const REPUTABLE_DOMAINS = [
  "reuters.com", "apnews.com", "bloomberg.com", "ft.com", "wsj.com", "nytimes.com", "washingtonpost.com", "theguardian.com",
  "bbc.co.uk", "bbc.com", "cnbc.com", "axios.com", "theinformation.com", "techcrunch.com", "theverge.com", "arstechnica.com",
  "wired.com", "technologyreview.com", "venturebeat.com", "zdnet.com", "engadget.com", "theregister.com", "siliconangle.com",
  "the-decoder.com", "tomshardware.com", "anandtech.com", "spectrum.ieee.org", "scmp.com", "caixinglobal.com", "technode.com",
  "pandaily.com", "restofworld.org", "nikkei.com", "asia.nikkei.com", "economist.com", "fortune.com", "businessinsider.com",
  "semafor.com", "platformer.news", "404media.co", "simonwillison.net", "nature.com", "science.org", "newscientist.com",
  "quantamagazine.org", "phys.org", "sciencedaily.com", "space.com", "9to5google.com", "9to5mac.com", "macrumors.com",
  "androidauthority.com", "theinformation.com", "politico.com", "politico.eu", "sbs.com.au", "abc.net.au", "thehindu.com",
  "livemint.com", "economictimes.indiatimes.com", "thenextweb.com", "infoq.com", "marktechpost.com", "latent.space",
];

// Aggregators and content farms: never used as sources.
export const BLOCKED_DOMAINS = [
  "inshorts.com", "msn.com", "newsbreak.com", "flipboard.com", "ground.news", "medium.com", "substack.com", "quora.com",
  "pinterest.com", "linkedin.com", "facebook.com", "instagram.com", "tiktok.com", "bluewin.ch", "yahoo.com", "aol.com",
];
