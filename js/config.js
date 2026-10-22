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
