// =====================================================================
// config.js - EVERYTHING YOU MAY WANT TO CHANGE LIVES IN THIS FILE.
// Edit only the text inside quotes or the true/false values.
// Numbers in [brackets] let you point at an exact line, e.g. "change [3]".
// =====================================================================

// [1] Gemini model name. If Google retires it and you see a "model not found"
//     error, replace it with a current name from https://ai.google.dev/gemini-api/docs/models
//     Safe values: "gemini-3.5-flash-lite" (fast, default), "gemini-3.8-flash" (smarter, busier).
export const MODEL_NAME = "gemini-3.5-flash-lite";

// [2] Your handle, shown in the footer of every slide. Example: "@yourname".
export const HANDLE = "@yourhandle";

// [3] Sign-off added to the end of the LinkedIn post. true = add it, false = leave it off.
export const SIGN_OFF_ENABLED = true;

// [4] The sign-off text itself. Only used when [3] is true.
export const SIGN_OFF = "PVU Divakar";

// [5] Maximum emojis allowed per post. Safe values: 0 to 3.
export const MAX_EMOJIS = 2;

// [6] Maximum hashtags allowed in the caption. Safe values: 0 to 10. The app also cuts extras.
export const MAX_HASHTAGS = 5;

// [7] Number of carousel slides the AI should aim for (including hook and call-to-action).
//     Safe values: 5 to 8.
export const MIN_SLIDES = 5;
export const MAX_SLIDES = 8;

// [8] Voice rules. One rule per line, plain English. The AI follows these in every post.
//     Add, remove or reword lines freely. Keep each line inside quotes, ending with a comma.
export const VOICE_RULES = [
  "You write as a cybersecurity professional explaining things to non-technical people.", // [8a]
  "Use layman terms. Include exactly one real-life analogy per post (locks, seatbelts, post office, etc.).", // [8b]
  "Write short sentences. If you must use a technical word, explain it in one plain line.", // [8c]
  "The first line must be a strong hook that makes a stranger stop scrolling.", // [8d]
  "Never use filler openers such as 'In today's fast-paced world' or 'In the digital age'.", // [8e]
  "Be calm and credible. No fear-mongering, no hype, no clickbait promises.", // [8f]
  "Never invent facts, statistics, CVE numbers, company names or credentials. Use only what the user gave you.", // [8g]
  "If the user's idea lacks a real example, keep the advice general instead of making one up.", // [8h]
  "End the LinkedIn post with one clear question or takeaway. Do not add a sign-off; the app adds it.", // [8i]
];

// [9] Slide themes. 'id' must match a theme in css/slides.css. 'label' is the button text.
//     Do not rename 'id' unless you also rename the matching CSS class.
export const THEMES = [
  { id: "editorial", label: "Dark editorial" },
  { id: "minimal", label: "Light minimal" },
  { id: "bold", label: "Bold contrast" },
];

// [10] Theme shown first. Must be one of the 'id' values in [9].
export const DEFAULT_THEME = "editorial";

// [11] Maximum characters in a LinkedIn post. LinkedIn's own limit is 3000.
export const LINKEDIN_LIMIT = 3000;

// [12] Slide size in pixels (Instagram 4:5 portrait). Change only if you also change css/slides.css.
export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

// [13] VIDEO SETTINGS. The app turns your slides into an MP4 you can upload as a Reel or a feed video.
//      Frames per second. Safe values: 24 to 30. Higher makes bigger files.
export const VIDEO_FPS = 30;

// [14] Fewest seconds any slide stays on screen. Safe values: 2 to 5.
export const VIDEO_MIN_SECONDS = 2.5;

// [15] Extra seconds added per word on a slide, so longer text stays up longer. Safe values: 0.08 to 0.3.
export const VIDEO_SECONDS_PER_WORD = 0.12;

// [16] Most seconds any one slide may stay on screen. Safe values: 4 to 10.
export const VIDEO_MAX_SECONDS = 6;

// [17] Length of the fade between slides, in seconds. Safe values: 0.2 to 1. Use 0 for hard cuts.
export const VIDEO_FADE_SECONDS = 0.5;

// [18] Video quality as megabits per second. Safe values: 2 to 8. Flat slide graphics look fine at 4, and files stay small.
export const VIDEO_MBPS = 4;

// [19] Video shapes. 'height' is in pixels (width is always [12]). 9:16 is for Reels and Stories.
//      First entry is the default.
export const VIDEO_FORMATS = [
  { id: "reel", label: "Reel / Story (9:16)", height: 1920 },
  { id: "feed", label: "Feed video (4:5)", height: 1350 },
];

// [20] KEY CATEGORIES. The first screen (API keys dashboard) is built from this list.
//      id: short internal name. title: card heading. needsKey: true = the app asks for keys here.
//      usedFor / notUsed: plain-English explanation shown on the card. Edit the wording freely.
//      Only the "writing" category can hold keys today. The others explain why no key is needed.
export const KEY_CATEGORIES = [
  {
    id: "writing",
    title: "Writing AI",
    needsKey: true,
    usedFor: "Turns your rough idea into the LinkedIn post, the slide text and the caption. This is the only step that calls an AI service.",
    notUsed: "Not used for PNG slides or MP4 videos. Those are made on your own computer.",
    multiKeyNote: "Pick any provider from the list below and add your own key. Add several keys, even from different providers. They are tried from top to bottom, and the app moves to the next when one hits a limit.",
  },
  {
    id: "voice",
    title: "Voice interviewer (Phase 2)",
    needsKey: false,
    usedFor: "Not built yet. When added, it will use your browser's built-in speech recognition and voices.",
    notUsed: "No key needed. Your browser vendor processes the audio, as described in the README privacy section.",
  },
  {
    id: "media",
    title: "Slides, PNG and video",
    needsKey: false,
    usedFor: "Drawn and encoded inside your browser, using your own computer.",
    notUsed: "No key needed and no cost.",
  },
];

// [21] AI PROVIDERS people can choose from on the API keys screen. Each person uses their OWN key.
//      id: short internal name (do not change). label: name shown on screen.
//      kind: how the app talks to it. "gemini", "openai" (the common format also used by Groq,
//            OpenRouter and local servers) or "anthropic".
//      baseUrl: the service address. defaultModel: used when the key's Model box is left empty.
//      keyRequired: false means no key is needed (a program on your own computer).
//      cost: a short honest note shown on screen. keyUrl: where to get a key.
//      Model names change often. If a provider says a model is not found, put a current name in the
//      Model box on the API keys screen, or change defaultModel here.
//      To add a provider that is not listed, add its web address to the connect-src part of the
//      Content-Security-Policy in index.html, or the browser will block the request.
export const PROVIDERS = [
  {
    id: "gemini",
    label: "Google Gemini",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/",
    defaultModel: MODEL_NAME, // [21a] Uses the model name from setting [1].
    keyRequired: true,
    cost: "Free tier available",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-20b",
    keyRequired: true,
    cost: "Free tier available",
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/free", // [21b] A router that picks a free model for you.
    keyRequired: true,
    cost: "Has free models, others are paid",
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-6-luna",
    keyRequired: true,
    cost: "Paid. Billed to your account",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-haiku-5-5",
    keyRequired: true,
    cost: "Paid. Billed to your account",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "local",
    label: "Local server (Ollama, LM Studio)",
    kind: "openai",
    baseUrl: "http://localhost:11434/v1", // [21c] Ollama's usual address. LM Studio usually uses port 1234.
    defaultModel: "",
    keyRequired: false,
    askBaseUrl: true, // [21d] Shows an "Address" box so you can change the port.
    cost: "Free. Runs on your computer and needs a downloaded model",
    keyUrl: "https://ollama.com/download",
  },
];
