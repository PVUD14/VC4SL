// llm.js - the ONLY file that talks to an AI service.
// To add another provider later (Groq, OpenRouter...), add a function like callGemini
// and choose it inside generateContent. Nothing else in the app needs to change.
import { MODEL_NAME, MAX_HASHTAGS, MAX_SLIDES, SIGN_OFF_ENABLED, SIGN_OFF } from "./config.js";
import { buildSystemPrompt, buildUserPrompt, RESPONSE_SCHEMA } from "./prompts.js";

// [1] Google's address for Gemini. It must also be allowed in the CSP tag in index.html.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

// [2] An error whose message is already written for a normal person.
//     action "keys" tells the UI to offer an "Open API keys" button.
//     failover true means "this key failed, so it is worth trying the next saved key".
export class FriendlyError extends Error {
  constructor(message, action = "", failover = false) {
    super(message);
    this.name = "FriendlyError";
    this.action = action;
    this.failover = failover;
  }
}

// [3] A canned answer so anyone can try the app without a key.
const DEMO_RESULT = {
  linkedin_post:
    "Your password is a house key. Most people use the same one for every door.\n\n" +
    "Imagine copying your front-door key and hiding it under the mat of every shop you visit. " +
    "One careless shop, and a stranger can walk into your home.\n\n" +
    "That is what reusing a password does. One website leaks it, and criminals try it everywhere else.\n\n" +
    "Three small habits fix most of this:\n" +
    "Use a password manager, so each site gets its own key.\n" +
    "Turn on two-step login, so a stolen key alone is not enough.\n" +
    "Change a password the moment a site says it was breached.\n\n" +
    "Which of these will you do first this week?",
  carousel: [
    { heading: "Your password is a house key", body: "" },
    { heading: "One key, many doors", body: "Reusing a password is like hiding copies of your house key at every shop." },
    { heading: "Why it goes wrong", body: "When one website leaks your password, criminals try it on your email and bank." },
    { heading: "Fix 1: a password manager", body: "It remembers a different strong password for every site, so you do not have to." },
    { heading: "Fix 2: two-step login", body: "A code on your phone means a stolen password alone cannot open the door." },
    { heading: "Fix 3: react fast", body: "If a site announces a breach, change that password the same day." },
    { heading: "Pick one today", body: "Which habit will you start this week? Tell me in the comments." },
  ],
  caption: "Your password is a house key.\nDo not hide copies of it everywhere.\nSwipe for three small fixes.",
  hashtags: ["cybersecurity", "passwords", "onlinesafety", "infosec", "privacy"],
};

// [4] Pick demo or live generation. Always returns the same clean shape.
//     'keys' is the list of saved writing keys. They are tried in order; if one hits its limit or
//     is rejected, the next is used. 'onUsage(keyId, tokens)' is called after every request.
export async function generateContent({ idea, goal, audience, keys, samples, demo, onUsage }) {
  if (demo) {
    await new Promise((resolve) => setTimeout(resolve, 700)); // [4a] Mimic a short wait.
    return { ...normalize(structuredClone(DEMO_RESULT)), usedKeyId: null, skipped: [] };
  }
  if (!keys || keys.length === 0) {
    throw new FriendlyError("No API key yet. Open API keys and add your free Gemini key, or try the demo.", "keys");
  }
  const system = buildSystemPrompt({ goal, audience, samples });
  const user = buildUserPrompt(idea);
  const skipped = [];
  let lastError;
  for (const entry of keys) {
    try {
      const result = await generateWithKey(entry, system, user, onUsage);
      return { ...result, usedKeyId: entry.id, skipped };
    } catch (error) {
      if (!error.failover) throw error;
      skipped.push({ label: entry.label, reason: error.message });
      lastError = error;
    }
  }
  const tried = keys.length > 1 ? ` (all ${keys.length} saved keys were tried)` : "";
  throw new FriendlyError(`${lastError.message}${tried}`, lastError.action);
}

// [4b] One key: ask once, and ask again only if the reply was broken JSON.
async function generateWithKey(entry, system, user, onUsage) {
  const call = () => callGemini({ apiKey: entry.key, model: entry.model || MODEL_NAME, system, user, schema: RESPONSE_SCHEMA, onUsage: (t) => onUsage?.(entry.id, t) });
  try {
    return normalize(await call());
  } catch (error) {
    if (error.code !== "BAD_JSON") throw error;
    try {
      return normalize(await call());
    } catch (second) {
      if (second.code === "BAD_JSON") {
        throw new FriendlyError("The AI replied in a broken format twice. Press Generate again, or try a shorter idea.");
      }
      throw second;
    }
  }
}

// [4c] A tiny request that proves a key works. It costs a few tokens, which are counted.
export async function testKey(entry, onUsage) {
  const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
  const data = await callGemini({
    apiKey: entry.key,
    model: entry.model || MODEL_NAME,
    system: "Reply with JSON only.",
    user: "Return {\"ok\": true}.",
    schema,
    onUsage: (t) => onUsage?.(entry.id, t),
  });
  if (data?.ok !== true) throw new FriendlyError("The key connected but the answer was unexpected. Try again.");
}

// [5] One Gemini request. The key goes in a header, never in the URL.
async function callGemini({ apiKey, model, system, user, schema, onUsage }) {
  let response;
  try {
    response = await fetch(`${GEMINI_BASE}${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.8 },
      }),
    });
  } catch {
    throw new FriendlyError("Could not reach Google. Check your internet connection and try again.");
  }
  if (!response.ok) throw await httpError(response);
  const data = await response.json();
  reportUsage(data, onUsage); // [5a] Tokens are spent even if the reply turns out unusable, so count them first.
  return parseReply(data);
}

// [5b] Read Google's own token counts from the reply. "output" includes any hidden thinking tokens.
function reportUsage(data, onUsage) {
  const meta = data.usageMetadata;
  if (!meta || !onUsage) return;
  const input = meta.promptTokenCount || 0;
  const total = meta.totalTokenCount || 0;
  onUsage({ input, output: Math.max(0, total - input), total });
}

// [6] Convert an HTTP failure into a plain-English message.
async function httpError(response) {
  let detail = "";
  try {
    detail = (await response.json()).error?.message || "";
  } catch {
    // Body was not JSON; the status code alone is enough.
  }
  const status = response.status;
  if (status === 429) return new FriendlyError("This key hit Google's free-tier limit. Wait about a minute, or add another key.", "keys", true);
  if (status === 400 && /api key/i.test(detail)) return new FriendlyError("Google rejected this API key. Check it on the API keys screen.", "keys", true);
  if (status === 401 || status === 403) return new FriendlyError("Google rejected this API key. Paste a fresh key from aistudio.google.com.", "keys", true);
  if (status === 404) return new FriendlyError("That model name is not available for this key. Clear the model box on the API keys screen to use the default.", "keys", true);
  if (status === 503 || status === 500) return new FriendlyError("Google's model is busy right now. Wait a moment and try again.", "", true);
  return new FriendlyError(`Google returned an error (code ${status}). ${detail}`.trim());
}

// [7] Pull the JSON out of Gemini's reply and detect blocked or empty answers.
function parseReply(data) {
  if (data.promptFeedback?.blockReason) {
    throw new FriendlyError("Google blocked this idea for safety reasons. Reword it and try again.");
  }
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    throw new FriendlyError("Google blocked the answer for safety reasons. Reword the idea and try again.");
  }
  const parts = candidate?.content?.parts || [];
  const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("");
  if (!text.trim()) throw new FriendlyError("Google returned an empty answer. Press Generate again.");
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("bad json"), { code: "BAD_JSON" });
  }
}

// [8] Check the shape, trim extras and add the sign-off. Throws BAD_JSON if unusable.
function normalize(raw) {
  const fail = () => Object.assign(new Error("bad shape"), { code: "BAD_JSON" });
  if (!raw || typeof raw.linkedin_post !== "string" || !Array.isArray(raw.carousel)) throw fail();
  const slides = raw.carousel
    .filter((s) => s && typeof s.heading === "string")
    .slice(0, MAX_SLIDES)
    .map((s) => ({ heading: s.heading.trim(), body: typeof s.body === "string" ? s.body.trim() : "" }));
  if (slides.length < 2) throw fail();
  const tags = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
    .filter((t) => typeof t === "string")
    .map((t) => t.replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter(Boolean)
    .slice(0, MAX_HASHTAGS);
  let post = raw.linkedin_post.trim();
  if (SIGN_OFF_ENABLED && SIGN_OFF && !post.endsWith(SIGN_OFF)) post += `\n\n${SIGN_OFF}`;
  return {
    linkedin: post,
    slides,
    caption: [String(raw.caption || "").trim(), tags.map((t) => `#${t}`).join(" ")].filter(Boolean).join("\n\n"),
  };
}
