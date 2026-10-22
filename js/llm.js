// llm.js - the ONLY file that talks to an AI service.
// It speaks three "dialects": Gemini, the common "openai" format (also used by Groq, OpenRouter,
// OpenAI and local servers such as Ollama), and Anthropic. Which one a key uses is set by its
// provider in config.js setting [21]. Nothing else in the app needs to know the difference.
import { PROVIDERS, MAX_HASHTAGS, MAX_SLIDES, SIGN_OFF_ENABLED, SIGN_OFF } from "./config.js";
import { buildSystemPrompt, buildUserPrompt, RESPONSE_SCHEMA } from "./prompts.js";

// [1] An error whose message is already written for a normal person.
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

// [2] Look up a provider by its id. Keys saved by older versions have no provider and mean Gemini.
export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === (id || "gemini")) || PROVIDERS[0];
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
    throw new FriendlyError("No API key yet. Open API keys and add a key from any provider, or try the demo.", "keys");
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
  const call = () => requestJson({ entry, system, user, schema: RESPONSE_SCHEMA, onUsage });
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
  const data = await requestJson({
    entry,
    system: "Reply with one JSON object and nothing else.",
    user: 'Return {"ok": true}.',
    schema,
    onUsage,
  });
  if (data?.ok !== true) throw new FriendlyError("The key connected but the answer was unexpected. Try again.");
}

// [5] Send one request using the key's provider, and return the parsed JSON object.
async function requestJson({ entry, system, user, schema, onUsage }) {
  const provider = getProvider(entry.provider);
  const model = (entry.model || provider.defaultModel || "").trim();
  if (!model) throw new FriendlyError(`${provider.label} needs a model name. Add one on the API keys screen.`, "keys");
  const report = (tokens) => onUsage?.(entry.id, tokens);
  const args = { entry, provider, model, system, user, schema, report };
  if (provider.kind === "gemini") return callGemini(args);
  if (provider.kind === "anthropic") return callAnthropic(args);
  return callOpenAiStyle(args);
}

// [6] Gemini. The key goes in a header, never in the URL.
async function callGemini({ entry, provider, model, system, user, schema, report }) {
  const response = await send(provider, entry, `${provider.baseUrl}${encodeURIComponent(model)}:generateContent`, {
    "Content-Type": "application/json",
    "x-goog-api-key": entry.key,
  }, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.8 },
  });
  const data = await response.json();
  const meta = data.usageMetadata;
  if (meta) report(tokens(meta.promptTokenCount, meta.totalTokenCount));
  if (data.promptFeedback?.blockReason) throw blocked(provider, "idea");
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") throw blocked(provider, "answer");
  const parts = candidate?.content?.parts || [];
  return toJson(parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join(""), provider);
}

// [7] The common "openai" format: Groq, OpenRouter, OpenAI and local servers. Key goes in a header.
async function callOpenAiStyle({ entry, provider, model, system, user, report }) {
  const url = `${(entry.baseUrl || provider.baseUrl).replace(/\/+$/, "")}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (entry.key) headers.Authorization = `Bearer ${entry.key}`;
  const body = {
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    temperature: 0.8,
    response_format: { type: "json_object" },
  };
  let response;
  try {
    response = await send(provider, entry, url, headers, body);
  } catch (error) {
    // [7a] Some models reject JSON mode. Retry once without it; the prompt already asks for JSON.
    if (!error.jsonModeRejected) throw error;
    delete body.response_format;
    response = await send(provider, entry, url, headers, body);
  }
  const data = await response.json();
  if (data.usage) report(tokens(data.usage.prompt_tokens, data.usage.total_tokens));
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "content_filter") throw blocked(provider, "answer");
  return toJson(choice?.message?.content || "", provider);
}

// [8] Anthropic. The browser-access header is required by Anthropic for calls made from a web page.
async function callAnthropic({ entry, provider, model, system, user, report }) {
  const response = await send(provider, entry, `${provider.baseUrl}/messages`, {
    "Content-Type": "application/json",
    "x-api-key": entry.key,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  }, {
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
    temperature: 0.8,
  });
  const data = await response.json();
  if (data.usage) {
    const input = data.usage.input_tokens || 0;
    const output = data.usage.output_tokens || 0;
    report({ input, output, total: input + output });
  }
  if (data.stop_reason === "refusal") throw blocked(provider, "answer");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return toJson(text, provider);
}

// [9] Shared helpers.
function tokens(input = 0, total = 0) {
  return { input, output: Math.max(0, total - input), total }; // "output" includes any hidden thinking tokens
}

function blocked(provider, what) {
  return new FriendlyError(`${provider.label} blocked this ${what} for safety reasons. Reword the idea and try again.`);
}

// [9a] POST JSON and return the response, or throw a friendly error.
async function send(provider, entry, url, headers, body) {
  let response;
  try {
    response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    const local = provider.id === "local";
    const message = local
      ? `Could not reach your local server at ${entry.baseUrl || provider.baseUrl}. Check that it is running and allows browser access (for Ollama, set OLLAMA_ORIGINS).`
      : `Could not reach ${provider.label}. Check your connection and try again.`;
    throw new FriendlyError(message, "", local);
  }
  if (!response.ok) throw await httpError(response, provider);
  return response;
}

// [9b] Turn an HTTP failure into a plain-English message.
async function httpError(response, provider) {
  let detail = "";
  try {
    const json = await response.json();
    detail = json.error?.message || json.message || "";
    if (typeof detail !== "string") detail = "";
  } catch {
    // Body was not JSON; the status code alone is enough.
  }
  const status = response.status;
  const name = provider.label;
  if (status === 400 && provider.kind === "openai" && /response_format|json/i.test(detail)) {
    return Object.assign(new FriendlyError("json mode rejected"), { jsonModeRejected: true });
  }
  if (status === 429) return new FriendlyError(`This ${name} key hit its rate limit. Wait about a minute, or add another key.`, "keys", true);
  if (status === 402) return new FriendlyError(`${name} says this account has no credit left. Add credit or use another key.`, "keys", true);
  if ((status === 400 && /api key/i.test(detail)) || status === 401 || status === 403) {
    return new FriendlyError(`${name} rejected this API key. Check it on the API keys screen.`, "keys", true);
  }
  if (status === 404) return new FriendlyError(`${name} does not know that model name. Fix the model on the API keys screen.`, "keys", true);
  if (status === 500 || status === 502 || status === 503 || status === 529) {
    return new FriendlyError(`${name} is busy right now. Wait a moment and try again.`, "", true);
  }
  return new FriendlyError(`${name} returned an error (code ${status}). ${detail}`.trim());
}

// [9c] Parse the model's text as JSON. Tolerates code fences or a sentence around the object.
function toJson(text, provider) {
  if (!text.trim()) throw new FriendlyError(`${provider.label} returned an empty answer. Press Generate again.`);
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  for (const candidate of [cleaned, cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next form.
    }
  }
  throw Object.assign(new Error("bad json"), { code: "BAD_JSON" });
}

// [10] Check the shape, trim extras and add the sign-off. Throws BAD_JSON if unusable.
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
