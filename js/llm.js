// llm.js - the ONLY file that talks to an AI service.
// To add another provider later (Groq, OpenRouter...), add a function like callGemini
// and choose it inside generateContent. Nothing else in the app needs to change.
import { MODEL_NAME, MAX_HASHTAGS, MAX_SLIDES, SIGN_OFF_ENABLED, SIGN_OFF } from "./config.js";
import { buildSystemPrompt, buildUserPrompt, RESPONSE_SCHEMA } from "./prompts.js";

// [1] Google's address for Gemini. It must also be allowed in the CSP tag in index.html.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

// [2] An error whose message is already written for a normal person.
export class FriendlyError extends Error {
  constructor(message, action = "") {
    super(message);
    this.name = "FriendlyError";
    this.action = action; // "settings" tells the UI to offer an "Open settings" button
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
export async function generateContent({ idea, goal, audience, apiKey, model, samples, demo }) {
  if (demo) {
    await new Promise((resolve) => setTimeout(resolve, 700)); // [4a] Mimic a short wait.
    return normalize(structuredClone(DEMO_RESULT));
  }
  if (!apiKey) {
    throw new FriendlyError("No API key yet. Open Settings and paste your free Gemini key, or try the demo.", "settings");
  }
  const system = buildSystemPrompt({ goal, audience, samples });
  const user = buildUserPrompt(idea);
  const chosenModel = (model || MODEL_NAME).trim();
  try {
    return normalize(await callGemini({ apiKey, model: chosenModel, system, user }));
  } catch (error) {
    // [4b] Malformed JSON gets exactly one retry; every other error is final.
    if (error.code !== "BAD_JSON") throw error;
    try {
      return normalize(await callGemini({ apiKey, model: chosenModel, system, user }));
    } catch (second) {
      if (second.code === "BAD_JSON") {
        throw new FriendlyError("The AI replied in a broken format twice. Press Generate again, or try a shorter idea.");
      }
      throw second;
    }
  }
}

// [5] One Gemini request. The key goes in a header, never in the URL.
async function callGemini({ apiKey, model, system, user }) {
  let response;
  try {
    response = await fetch(`${GEMINI_BASE}${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA, temperature: 0.8 },
      }),
    });
  } catch {
    throw new FriendlyError("Could not reach Google. Check your internet connection and try again.");
  }
  if (!response.ok) throw await httpError(response);
  return parseReply(await response.json());
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
  if (status === 429) return new FriendlyError("Free-tier limit reached. Wait about a minute and try again, or switch the model in Settings.");
  if (status === 400 && /api key/i.test(detail)) return new FriendlyError("Google rejected this API key. Check it in Settings.", "settings");
  if (status === 401 || status === 403) return new FriendlyError("Google rejected this API key. Paste a fresh key from aistudio.google.com in Settings.", "settings");
  if (status === 404) return new FriendlyError("That model name is not available. Change the model in Settings or in config.js line [1].", "settings");
  if (status === 503 || status === 500) return new FriendlyError("Google's model is busy right now. Wait a moment and press Generate again.");
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
