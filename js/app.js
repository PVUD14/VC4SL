// app.js - connects the page to the generator, the slide renderer and storage.
import { MODEL_NAME, THEMES, DEFAULT_THEME, LINKEDIN_LIMIT, SLIDE_WIDTH } from "./config.js";
import { load, save, remove } from "./storage.js";
import { generateContent, FriendlyError } from "./llm.js";
import { buildSlide, fitSlide, slideToBlob, slidesToZip, downloadBlob } from "./render.js";

// [1] The one place that holds the current result and the chosen theme.
const state = { slides: [], theme: load("theme", DEFAULT_THEME), busy: false };
if (!THEMES.some((t) => t.id === state.theme)) state.theme = DEFAULT_THEME;

const $ = (id) => document.getElementById(id);

// [2] Show a message in the status box. kind is "loading", "error" or "info".
function setStatus(kind, message, withSettingsButton = false) {
  const box = $("status");
  box.hidden = false;
  box.className = `status is-${kind}`;
  box.replaceChildren(Object.assign(document.createElement("span"), { textContent: message }));
  if (withSettingsButton) {
    const button = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-secondary", textContent: "Open Settings" });
    button.addEventListener("click", openSettings);
    box.append(button);
  }
}

function clearStatus() {
  $("status").hidden = true;
  $("status").replaceChildren();
}

// [3] Run a generation (live or demo) and show the result.
async function run(demo) {
  if (state.busy) return;
  const idea = $("idea").value;
  if (!demo && idea.trim().length < 15) {
    setStatus("error", "Write a bit more first: at least a sentence or two about your idea.");
    $("idea").focus();
    return;
  }
  setBusy(true);
  setStatus("loading", demo ? "Loading the demo..." : "Writing your content. This usually takes 5 to 20 seconds...");
  try {
    const result = await generateContent({
      idea,
      goal: $("goal").value,
      audience: $("audience").value,
      apiKey: load("apiKey"),
      model: load("model") || MODEL_NAME,
      samples: load("samples"),
      demo,
    });
    showResult(result);
    clearStatus();
  } catch (error) {
    const friendly = error instanceof FriendlyError;
    setStatus("error", friendly ? error.message : "Something unexpected went wrong. Please try again.", friendly && error.action === "settings");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  $("generate").disabled = busy;
  $("demo").disabled = busy;
  $("generate").textContent = busy ? "Working..." : "Generate";
}

// [4] Fill the three tabs from a result.
function showResult(result) {
  state.slides = result.slides;
  $("linkedin-text").value = result.linkedin;
  $("caption-text").value = result.caption;
  updateCounts();
  $("results").hidden = false;
  selectTab("tab-linkedin", false);
  renderSlides();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateCounts() {
  const length = $("linkedin-text").value.length;
  const count = $("linkedin-count");
  count.textContent = `${length} / ${LINKEDIN_LIMIT} characters`;
  count.classList.toggle("over", length > LINKEDIN_LIMIT);
  $("caption-count").textContent = `${$("caption-text").value.length} characters`;
}

// [5] Tabs: click or use the arrow keys.
const TAB_IDS = ["tab-linkedin", "tab-carousel", "tab-caption"];

function selectTab(id, focus) {
  for (const tabId of TAB_IDS) {
    const selected = tabId === id;
    const tab = $(tabId);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !selected;
    if (selected && focus) tab.focus();
  }
  if (id === "tab-carousel") refitAll();
}

// [6] Slide previews. Each slide is shown scaled down inside a frame.
function renderSlides() {
  const holder = $("slides");
  holder.replaceChildren();
  state.slides.forEach((slide, index) => {
    const card = document.createElement("div");
    card.className = "slide-card";
    const frame = document.createElement("div");
    frame.className = "slide-frame";
    const node = buildSlide(slide, index, state.slides.length, state.theme, true);
    frame.append(node);
    const button = Object.assign(document.createElement("button"), {
      type: "button",
      className: "btn btn-secondary",
      textContent: `Download slide ${index + 1} (PNG)`,
    });
    button.addEventListener("click", () => exportOne(index, button));
    node.addEventListener("input", () => onSlideEdit(node, index));
    card.append(frame, button);
    holder.append(card);
  });
  refitAll();
}

function onSlideEdit(node, index) {
  state.slides[index] = {
    heading: node.querySelector(".slide-heading").textContent,
    body: node.querySelector(".slide-body")?.textContent || "",
  };
  fitSlide(node);
}

// [7] Fit text and scale previews to their frames. Runs after layout is ready.
function refitAll() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".slide-frame").forEach((frame) => {
      const node = frame.querySelector(".slide");
      fitSlide(node);
      node.style.transform = `scale(${frame.clientWidth / SLIDE_WIDTH})`;
    });
  });
}

new ResizeObserver(refitScale).observe(document.body);
function refitScale() {
  document.querySelectorAll(".slide-frame").forEach((frame) => {
    const node = frame.querySelector(".slide");
    if (frame.clientWidth) node.style.transform = `scale(${frame.clientWidth / SLIDE_WIDTH})`;
  });
}

// [8] Exports.
async function exportOne(index, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Rendering...";
  try {
    const blob = await slideToBlob(state.slides[index], index, state.slides.length, state.theme);
    downloadBlob(blob, `slide-${String(index + 1).padStart(2, "0")}.png`);
  } catch {
    setStatus("error", "Could not create that image. Try again, or try another browser such as Chrome.");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function exportZip() {
  const button = $("download-zip");
  button.disabled = true;
  button.textContent = "Building ZIP...";
  try {
    downloadBlob(await slidesToZip(state.slides, state.theme), "carousel-slides.zip");
  } catch {
    setStatus("error", "Could not build the ZIP. Try downloading slides one by one.");
  } finally {
    button.disabled = false;
    button.textContent = "Download all as ZIP";
  }
}

// [9] Theme switcher buttons.
function buildThemeSwitch() {
  const group = $("theme-switch");
  for (const theme of THEMES) {
    const button = Object.assign(document.createElement("button"), { type: "button", textContent: theme.label });
    button.dataset.theme = theme.id;
    button.setAttribute("aria-pressed", String(theme.id === state.theme));
    button.addEventListener("click", () => {
      state.theme = theme.id;
      save("theme", theme.id);
      group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      renderSlides();
    });
    group.append(button);
  }
}

// [10] Copy buttons.
async function copyFrom(button) {
  const text = $(button.dataset.copy).value;
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    $(button.dataset.copy).select();
    button.textContent = "Press Ctrl+C to copy";
  }
  setTimeout(() => { button.textContent = label; }, 1800);
}

// [11] Settings dialog.
function openSettings() {
  $("api-key").value = load("apiKey");
  $("model").value = load("model") || MODEL_NAME;
  $("samples").value = load("samples");
  $("settings-msg").textContent = "";
  $("settings").showModal();
}

function saveSettings(event) {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const ok = [
    save("apiKey", $("api-key").value.trim()),
    save("model", $("model").value.trim()),
    save("samples", $("samples").value.trim()),
  ].every(Boolean);
  $("settings-msg").textContent = ok ? "Saved in this browser." : "Your browser blocked saving. Check its privacy settings.";
}

function clearKey() {
  remove("apiKey");
  $("api-key").value = "";
  $("settings-msg").textContent = "Key removed from this browser.";
}

// [12] Wire everything up.
$("generate").addEventListener("click", () => run(false));
$("demo").addEventListener("click", () => run(true));
$("open-settings").addEventListener("click", openSettings);
$("settings-form").addEventListener("submit", saveSettings);
$("clear-key").addEventListener("click", clearKey);
$("download-zip").addEventListener("click", exportZip);
$("linkedin-text").addEventListener("input", updateCounts);
$("caption-text").addEventListener("input", updateCounts);
document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copyFrom(button)));
TAB_IDS.forEach((id, i) => {
  $(id).addEventListener("click", () => selectTab(id, false));
  $(id).addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step) selectTab(TAB_IDS[(i + step + TAB_IDS.length) % TAB_IDS.length], true);
  });
});
buildThemeSwitch();
