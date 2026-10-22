// dashboard.js - the "API keys" screen (shown first) and the bottom bar that counts tokens per key.
// All text from the user (key labels) and from config is set with textContent, never as HTML.
import { KEY_CATEGORIES, MODEL_NAME } from "./config.js";
import { listKeys, addKey, removeKey, maskKey, getUsage, recordUsage, resetUsage } from "./keys.js";
import { testKey, FriendlyError } from "./llm.js";

const $ = (id) => document.getElementById(id);
let handlers = { onContinue() {}, onDemo() {} };

// [1] Tiny helper to make an element with a class and text.
function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const node = make("button", `btn ${className}`, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

// [2] Set up the screen. 'onContinue' opens the main app; 'onDemo' opens it and runs the demo.
export function initDashboard(callbacks) {
  handlers = callbacks;
  $("keys-continue").addEventListener("click", () => handlers.onContinue());
  $("keys-demo").addEventListener("click", () => handlers.onDemo());
  $("reset-usage").addEventListener("click", () => {
    resetUsage();
    renderUsageBar();
    renderDashboard();
  });
  renderDashboard();
  renderUsageBar();
}

// [3] Count tokens for a key and refresh both the bar and the key list.
export function trackUsage(keyId, tokens) {
  recordUsage(keyId, tokens);
  renderUsageBar();
}

const fmt = (n) => Number(n).toLocaleString("en-US");

// [4] Build every category card. Called again after any change.
export function renderDashboard() {
  const holder = $("key-cards");
  holder.replaceChildren(...KEY_CATEGORIES.map(buildCard));
  const ready = KEY_CATEGORIES.filter((c) => c.needsKey).every((c) => listKeys(c.id).length > 0);
  $("keys-continue").disabled = !ready;
  $("keys-continue-hint").textContent = ready ? "" : "Add at least one key to continue, or try the demo.";
}

function buildCard(category) {
  const card = make("section", "key-card");
  card.setAttribute("aria-labelledby", `cat-${category.id}`);
  const head = make("div", "key-card-head");
  const title = make("h2", "", category.title);
  title.id = `cat-${category.id}`;
  head.append(title, make("span", category.needsKey ? "badge badge-need" : "badge", category.needsKey ? "Key needed" : "No key needed"));
  card.append(head);
  if (category.provider) card.append(make("p", "key-provider", `Provider: ${category.provider}`));
  card.append(make("p", "", category.usedFor), make("p", "hint", category.notUsed));
  if (!category.needsKey) return card;

  card.append(make("p", "hint", category.multiKeyNote));
  const keys = listKeys(category.id);
  const list = make("ul", "key-list");
  if (keys.length === 0) list.append(make("li", "key-empty", "No keys saved yet."));
  keys.forEach((entry) => list.append(buildKeyRow(entry)));
  card.append(list, buildAddForm(category));
  if (category.getKeyUrl) {
    const link = make("a", "key-link", category.getKeyText);
    link.href = category.getKeyUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
  }
  return card;
}

// [5] One saved key: name, masked value, model, and Test / Remove buttons.
function buildKeyRow(entry) {
  const row = make("li", "key-row");
  const info = make("div", "key-info");
  const usage = getUsage(entry.id);
  info.append(
    make("strong", "", entry.label), " ",
    make("span", "key-mask", maskKey(entry.key)), " ",
    make("span", "hint", `Model: ${entry.model || MODEL_NAME} · ${fmt(usage.total)} tokens used`),
  );
  const message = make("span", "key-msg");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const testButton = button("Test", "btn-secondary", async () => {
    testButton.disabled = true;
    testButton.textContent = "Testing...";
    message.textContent = "";
    try {
      await testKey(entry, trackUsage);
      message.textContent = "Works.";
    } catch (error) {
      message.textContent = error instanceof FriendlyError ? error.message : "Could not test this key.";
    }
    testButton.disabled = false;
    testButton.textContent = "Test";
  });
  const removeButton = button("Remove", "btn-quiet", () => {
    removeKey(entry.id);
    renderDashboard();
    renderUsageBar();
  });
  removeButton.setAttribute("aria-label", `Remove ${entry.label}`);
  testButton.setAttribute("aria-label", `Test ${entry.label}`);
  row.append(info, make("div", "key-actions", ""), message);
  row.querySelector(".key-actions").append(testButton, removeButton);
  return row;
}

// [6] The "add a key" form for one category.
function buildAddForm(category) {
  const form = make("div", "key-form");
  const field = (id, label, type, placeholder) => {
    const wrap = make("div", "field");
    const labelNode = make("label", "", label);
    labelNode.htmlFor = `${category.id}-${id}`;
    const input = make("input");
    input.id = `${category.id}-${id}`;
    input.type = type;
    input.placeholder = placeholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    wrap.append(labelNode, input);
    return { wrap, input };
  };
  const label = field("label", "Name (optional)", "text", "e.g. Personal, Backup");
  const key = field("key", "API key", "password", "Paste your key");
  const model = field("model", "Model (optional)", "text", MODEL_NAME);
  const message = make("p", "hint");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const add = () => {
    const result = addKey({ category: category.id, label: label.input.value, key: key.input.value, model: model.input.value });
    if (!result.ok) {
      message.textContent = result.message;
      return;
    }
    renderDashboard();
    renderUsageBar();
  };
  key.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") add();
  });
  form.append(label.wrap, key.wrap, model.wrap, button("Add key", "btn-primary", add), message);
  return form;
}

// [7] The bottom bar: one chip per saved key showing tokens used today and in total.
export function renderUsageBar() {
  const list = $("usage-list");
  const keys = listKeys();
  if (keys.length === 0) {
    list.replaceChildren(make("li", "usage-empty", "No keys yet. Token counts will appear here."));
    return;
  }
  list.replaceChildren(...keys.map((entry) => {
    const usage = getUsage(entry.id);
    const chip = make("li", "usage-chip");
    chip.title = `Input ${fmt(usage.input)} + output ${fmt(usage.output)} tokens`;
    // [7a] Plain spaces between items keep the text readable for screen readers.
    chip.append(
      make("strong", "", entry.label), " ",
      make("span", "usage-mask", maskKey(entry.key)), " ",
      make("span", "usage-num", `Today ${fmt(usage.dayTotal)} tokens`), " ",
      make("span", "usage-num", `Total ${fmt(usage.total)} tokens`), " ",
      make("span", "usage-num", `${fmt(usage.requests)} request${usage.requests === 1 ? "" : "s"}`),
    );
    return chip;
  }));
}
