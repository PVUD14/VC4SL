// keys.js - the key vault and the token counter. Everything lives in this browser's localStorage.
// Keys are never logged and never placed in a URL. Token counts are measured by this app
// from the AI's own replies, so they are good estimates but not Google's official quota numbers.
import { load, remove, loadJson, saveJson } from "./storage.js";

// [1] Names under which data is saved.
const KEYS_NAME = "keys";
const USAGE_NAME = "usage";

// [2] The saved keys. Each entry: { id, category, label, key, model }.
export function listKeys(category) {
  const all = loadJson(KEYS_NAME, []);
  const valid = Array.isArray(all) ? all.filter((k) => k && typeof k.id === "string" && typeof k.key === "string") : [];
  return category ? valid.filter((k) => k.category === category) : valid;
}

// [3] Add a key. Returns { ok: true } or { ok: false, message } in plain English.
export function addKey({ category, label, key, model }) {
  const cleanKey = key.trim();
  if (cleanKey.length < 20 || /\s/.test(cleanKey)) {
    return { ok: false, message: "That does not look like a full key. Copy the whole key with no spaces." };
  }
  const existing = listKeys();
  if (existing.some((k) => k.key === cleanKey)) return { ok: false, message: "This key is already saved." };
  const number = existing.filter((k) => k.category === category).length + 1;
  const entry = {
    id: crypto.randomUUID(),
    category,
    label: label.trim() || `Key ${number}`,
    key: cleanKey,
    model: model.trim(),
  };
  const saved = saveJson(KEYS_NAME, [...existing, entry]);
  return saved ? { ok: true, entry } : { ok: false, message: "Your browser blocked saving. Check its privacy settings." };
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
  return `••••${key.slice(-4)}`;
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
