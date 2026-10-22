// dashboard.js - the "API keys" screen (shown first) and the bottom bar that counts tokens per key.
// All text from the user (key labels) and from config is set with textContent, never as HTML.
import { KEY_CATEGORIES, PROVIDERS } from "./config.js";
import { listKeys, addKey, removeKey, moveKey, maskKey, getUsage, recordUsage, resetUsage } from "./keys.js";
import { testKey, getProvider, FriendlyError } from "./llm.js";

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

// [4] Build the screen: the key-taking cards on the left, explanations on the right.
export function renderDashboard() {
  const main = KEY_CATEGORIES.filter((c) => c.needsKey).map(buildKeyCard);
  const side = make("div", "key-side");
  KEY_CATEGORIES.filter((c) => !c.needsKey).forEach((c) => side.append(buildInfoCard(c)));
  side.append(buildTrustCard());
  const column = make("div", "key-main");
  column.append(...main);
  $("key-cards").replaceChildren(column, side);
  const ready = KEY_CATEGORIES.filter((c) => c.needsKey).every((c) => listKeys(c.id).length > 0);
  $("keys-continue").disabled = !ready;
  $("keys-continue-hint").textContent = ready ? "" : "Add at least one key to continue, or try the demo.";
}

// [4a] A category that needs no key: just an explanation.
function buildInfoCard(category) {
  const card = make("section", "key-card key-card-info");
  card.setAttribute("aria-labelledby", `cat-${category.id}`);
  const head = make("div", "key-card-head");
  const title = make("h2", "", category.title);
  title.id = `cat-${category.id}`;
  head.append(title, make("span", "badge", "No key needed"));
  card.append(head, make("p", "", category.usedFor), make("p", "hint", category.notUsed));
  return card;
}

// [4b] A short note on how keys are handled, to build trust.
function buildTrustCard() {
  const card = make("section", "trust");
  card.setAttribute("aria-labelledby", "trust-title");
  const title = make("h2", "", "How your keys are handled");
  title.id = "trust-title";
  const list = make("ul");
  [
    "Stored only in this browser, on this computer.",
    "Sent only to the provider you pick, never to anyone else.",
    "Shown as the last four characters, never logged, never put in a web address.",
    "You can remove a key at any time.",
  ].forEach((line) => list.append(make("li", "", line)));
  card.append(title, list);
  return card;
}

// [4c] A category that takes keys: title, saved keys, and the add form.
function buildKeyCard(category) {
  const card = make("section", "key-card key-card-main");
  card.setAttribute("aria-labelledby", `cat-${category.id}`);
  const head = make("div", "key-card-head");
  const title = make("h2", "", category.title);
  title.id = `cat-${category.id}`;
  head.append(title, make("span", "badge badge-need", "Key needed"));
  card.append(head, make("p", "", category.usedFor), make("p", "hint", category.notUsed), make("p", "hint", category.multiKeyNote));

  const keys = listKeys(category.id);
  card.append(make("p", "key-sub", "Your keys, tried in this order"));
  const list = make("ul", "key-list");
  if (keys.length === 0) list.append(make("li", "key-empty", "No keys saved yet."));
  keys.forEach((entry, index) => list.append(buildKeyRow(entry, index, keys.length)));
  card.append(list, make("p", "key-sub", "Add a key"), buildAddForm(category));
  return card;
}

// [5] One saved key: its rank, name, provider, masked value, and Test / order / Remove buttons.
function buildKeyRow(entry, index, count) {
  const provider = getProvider(entry.provider);
  const row = make("li", "key-row");
  const usage = getUsage(entry.id);
  const info = make("div", "key-info");
  info.append(
    make("strong", "", entry.label), " ",
    make("span", "key-mask", `${provider.label} · ${maskKey(entry.key)}`), " ",
    make("span", "hint", `Model: ${entry.model || provider.defaultModel} · ${fmt(usage.total)} tokens used`),
  );
  const message = make("span", "key-msg");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const testButton = button("Test", "btn-ghost", async () => {
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
  const upButton = button("↑", "btn-ghost", () => reorder(entry.id, -1));
  const downButton = button("↓", "btn-ghost", () => reorder(entry.id, 1));
  upButton.disabled = index === 0;
  downButton.disabled = index === count - 1;
  upButton.setAttribute("aria-label", `Try ${entry.label} earlier`);
  downButton.setAttribute("aria-label", `Try ${entry.label} later`);
  const removeButton = button("Remove", "btn-ghost", () => {
    removeKey(entry.id);
    renderDashboard();
    renderUsageBar();
  });
  removeButton.setAttribute("aria-label", `Remove ${entry.label}`);
  testButton.setAttribute("aria-label", `Test ${entry.label}`);
  const actions = make("div", "key-actions");
  actions.append(testButton, upButton, downButton, removeButton);
  const rank = make("span", "key-rank", String(index + 1));
  rank.setAttribute("aria-hidden", "true");
  row.append(rank, info, actions, message);
  return row;
}

function reorder(id, direction) {
  moveKey(id, direction);
  renderDashboard();
  renderUsageBar();
}

// [6] The "add a key" form: pick a provider tile, then fill in the rest.
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
    return { wrap, input, labelNode };
  };

  // [6a] Provider tiles: radio buttons dressed as cards, so they work with the keyboard.
  const tiles = make("fieldset", "providers");
  tiles.append(make("legend", "", "Provider"));
  PROVIDERS.forEach((p, index) => {
    const tile = make("label", "tile");
    const radio = make("input");
    radio.type = "radio";
    radio.name = `${category.id}-provider`;
    radio.value = p.id;
    radio.checked = index === 0;
    const body = make("span", "tile-body");
    const paid = /^paid/i.test(p.cost);
    body.append(make("span", "tile-mono", p.mark || p.label.slice(0, 2)), make("span", "tile-name", p.label.split(" (")[0]), make("span", paid ? "tile-cost paid" : "tile-cost", p.cost));
    tile.append(radio, body);
    tiles.append(tile);
  });
  const selected = () => tiles.querySelector("input:checked").value;

  const about = make("p", "hint provider-about");
  const link = make("a", "key-link");
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const label = field("label", "Name (optional)", "text", "e.g. Personal, Backup");
  const key = field("key", "API key", "password", "Paste your key");
  const model = field("model", "Model (optional)", "text", "");
  const address = field("address", "Server address", "text", "");
  const fields = make("div", "fields");
  fields.append(label.wrap, key.wrap, model.wrap, address.wrap);
  const message = make("p", "hint form-msg");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  // [6b] Whenever the provider changes, update the hints and show only the fields it needs.
  const refresh = () => {
    const provider = getProvider(selected());
    about.textContent = provider.keyRequired ? "" : "No key is needed for this one. Start the program first and download a model.";
    link.textContent = provider.keyRequired ? `Get a key from ${provider.label} →` : `Download ${provider.label.split(" (")[0]} →`;
    link.href = provider.keyUrl;
    key.labelNode.textContent = provider.keyRequired ? "API key" : "API key (not needed)";
    key.input.placeholder = provider.keyRequired ? "Paste your key" : "Leave empty";
    model.labelNode.textContent = provider.defaultModel ? "Model (optional)" : "Model (required)";
    model.input.placeholder = provider.defaultModel || "e.g. llama3.2";
    address.wrap.hidden = !provider.askBaseUrl;
    address.input.placeholder = provider.baseUrl;
    message.textContent = "";
  };
  tiles.addEventListener("change", refresh);

  const add = () => {
    const result = addKey({
      category: category.id,
      provider: selected(),
      label: label.input.value,
      key: key.input.value,
      model: model.input.value,
      baseUrl: address.input.value,
    });
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
  const addRow = make("div", "add-row");
  addRow.append(button("Add key", "btn-primary", add), link);
  form.append(tiles, about, fields, message, addRow);
  refresh();
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
      make("span", "usage-mask", `${getProvider(entry.provider).label} ${maskKey(entry.key)}`), " ",
      make("span", "usage-num", `Today ${fmt(usage.dayTotal)} tokens`), " ",
      make("span", "usage-num", `Total ${fmt(usage.total)} tokens`), " ",
      make("span", "usage-num", `${fmt(usage.requests)} request${usage.requests === 1 ? "" : "s"}`),
    );
    return chip;
  }));
}
