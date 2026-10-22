// keys.js - the key vault and the token counter. Everything lives in this browser's localStorage.
// Keys are never logged and never placed in a URL. Token counts are measured by this app
// from the AI's own replies, so they are good estimates but not Google's official quota numbers.
import { load, remove, loadJson, saveJson } from "./storage.js";
import { PROVIDERS } from "./config.js";

// [1] Names under which data is saved.
const KEYS_NAME = "keys";
const USAGE_NAME = "usage";

// [2] The saved keys. Each entry: { id, category, provider, label, key, model, baseUrl }.
//     Keys saved by older versions have no provider and are treated as Gemini.
export function listKeys(category) {
  const all = loadJson(KEYS_NAME, []);
  const valid = Array.isArray(all) ? all.filter((k) => k && typeof k.id === "string" && typeof k.key === "string") : [];
  const withProvider = valid.map((k) => ({ ...k, provider: k.provider || "gemini" }));
  return category ? withProvider.filter((k) => k.category === category) : withProvider;
}

// [3] Add a key. Returns { ok: true } or { ok: false, message } in plain English.
export function addKey({ category, provider = "gemini", label, key, model, baseUrl = "" }) {
  const info = PROVIDERS.find((p) => p.id === provider);
  if (!info) return { ok: false, message: "Choose a provider first." };
  const cleanKey = key.trim();
  if (info.keyRequired && (cleanKey.length < 20 || /\s/.test(cleanKey))) {
    return { ok: false, message: "That does not look like a full key. Copy the whole key with no spaces." };
  }
  if (!info.keyRequired && cleanKey && /\s/.test(cleanKey)) return { ok: false, message: "A key cannot contain spaces." };
  if (!info.defaultModel && !model.trim()) {
    return { ok: false, message: `${info.label} needs a model name. Type the name of a model you have installed.` };
  }
  const cleanUrl = baseUrl.trim();
  if (info.askBaseUrl && cleanUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/.test(cleanUrl)) {
    return { ok: false, message: "The address must start with http://localhost or http://127.0.0.1, for example http://localhost:11434/v1." };
  }
  const existing = listKeys();
  if (cleanKey && existing.some((k) => k.key === cleanKey)) return { ok: false, message: "This key is already saved." };
  const number = existing.filter((k) => k.category === category).length + 1;
  const entry = {
    id: crypto.randomUUID(),
    category,
    provider,
    label: label.trim() || `${info.label} ${number}`,
    key: cleanKey,
    model: model.trim(),
    baseUrl: info.askBaseUrl ? cleanUrl : "",
  };
  const saved = saveJson(KEYS_NAME, [...existing, entry]);
  return saved ? { ok: true, entry } : { ok: false, message: "Your browser blocked saving. Check its privacy settings." };
}

// [3a] Move a key one place up (-1) or down (+1) in its category. The order is the order tried.
export function moveKey(id, direction) {
  const all = listKeys();
  const index = all.findIndex((k) => k.id === id);
  if (index < 0) return;
  const category = all[index].category;
  let swap = index + direction;
  while (swap >= 0 && swap < all.length && all[swap].category !== category) swap += direction;
  if (swap < 0 || swap >= all.length) return;
  [all[index], all[swap]] = [all[swap], all[index]];
  saveJson(KEYS_NAME, all);
}

// [4] Remove a key and its counts.
export function removeKey(id) {
  saveJson(KEYS_NAME, listKeys().filter((k) => k.id !== id));
  const usage = loadJson(USAGE_NAME, {});
  delete usage[id];
  saveJson(USAGE_NAME, usage);
}

// [5] Show only the last four characters so a key is never displayed in full.
export function maskKey(key) {
  return key ? `••••${key.slice(-4)}` : "no key";
}

// [6] Today's date as text, used to keep a "today" counter that restarts each day.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// [7] Add one request's token counts to a key's totals.
export function recordUsage(id, { input = 0, output = 0, total = 0 }) {
  const all = loadJson(USAGE_NAME, {});
  const now = all[id] || { requests: 0, input: 0, output: 0, total: 0, day: today(), dayTotal: 0 };
  if (now.day !== today()) {
    now.day = today();
    now.dayTotal = 0;
  }
  now.requests += 1;
  now.input += input;
  now.output += output;
  now.total += total;
  now.dayTotal += total;
  all[id] = now;
  saveJson(USAGE_NAME, all);
}

// [8] Read a key's totals. "dayTotal" reads as 0 if the saved day is not today.
export function getUsage(id) {
  const now = loadJson(USAGE_NAME, {})[id];
  if (!now) return { requests: 0, input: 0, output: 0, total: 0, dayTotal: 0 };
  return { ...now, dayTotal: now.day === today() ? now.dayTotal : 0 };
}

// [9] Zero every counter (keys stay saved).
export function resetUsage() {
  saveJson(USAGE_NAME, {});
}

// [10] One-time upgrade from the old single-key version: move that key into the new list.
export function migrateLegacyKey() {
  const legacy = load("apiKey");
  if (!legacy) return;
  const moved = listKeys().length > 0 || addKey({ category: "writing", label: "My Gemini key", key: legacy, model: load("model") }).ok;
  if (!moved) return; // [10a] Keep the old key if it could not be moved, so nothing is lost.
  remove("apiKey");
  remove("model");
}
