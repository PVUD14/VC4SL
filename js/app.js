// app.js - connects the page to the generator, the slide renderer and storage.
import { THEMES, DEFAULT_THEME, LINKEDIN_LIMIT, SLIDE_WIDTH, VIDEO_FORMATS } from "./config.js";
import { load, save } from "./storage.js";
import { listKeys, migrateLegacyKey } from "./keys.js";
import { initDashboard, renderDashboard, trackUsage } from "./dashboard.js";
import { generateContent, FriendlyError } from "./llm.js";
import { buildSlide, fitSlide, slideToBlob, slidesToZip, downloadBlob } from "./render.js";
import { makeVideo, videoSupported } from "./video.js";

// [1] The one place that holds the current result and the chosen theme.
const state = { slides: [], theme: load("theme", DEFAULT_THEME), busy: false };
if (!THEMES.some((t) => t.id === state.theme)) state.theme = DEFAULT_THEME;

const $ = (id) => document.getElementById(id);

// [2] Show a message in the status box. kind is "loading", "error" or "info".
function setStatus(kind, message, withKeysButton = false) {
  const box = $("status");
  box.hidden = false;
  box.className = `status is-${kind}`;
  box.replaceChildren(Object.assign(document.createElement("span"), { textContent: message }));
  if (withKeysButton) {
    const button = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-secondary", textContent: "Open API keys" });
    button.addEventListener("click", () => showScreen("keys"));
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
      keys: listKeys("writing"),
      samples: load("samples"),
      demo,
      onUsage: trackUsage,
    });
    showResult(result);
    clearStatus();
    if (result.skipped.length > 0) {
      const used = listKeys("writing").find((k) => k.id === result.usedKeyId);
      const names = result.skipped.map((k) => `"${k.label}"`).join(", ");
      setStatus("info", `Key ${names} failed, so the app used "${used?.label}" instead.`);
    }
  } catch (error) {
    const friendly = error instanceof FriendlyError;
    setStatus("error", friendly ? error.message : "Something unexpected went wrong. Please try again.", friendly && error.action === "keys");
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
const TAB_IDS = ["tab-linkedin", "tab-carousel", "tab-video", "tab-caption"];

function selectTab(id, focus) {
  for (const tabId of TAB_IDS) {
    const selected = tabId === id;
    const tab = $(tabId);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !selected;
    if (selected && focus) tab.focus();
  }
  $("theme-bar").hidden = !["tab-carousel", "tab-video"].includes(id);
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
  clearVideo();
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
      clearVideo();
      group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      renderSlides();
    });
    group.append(button);
  }
}

// [9b] Video. Builds an MP4 from the current slides and theme, shows it, and offers a download.
const videoState = { url: "", blob: null, busy: false };

function clearVideo() {
  if (videoState.url) URL.revokeObjectURL(videoState.url);
  videoState.url = "";
  videoState.blob = null;
  $("video-result").hidden = true;
  $("video-player").removeAttribute("src");
  $("video-msg").textContent = "";
}

function setupVideoControls() {
  const select = $("video-format");
  for (const format of VIDEO_FORMATS) select.append(new Option(format.label, format.id));
  if (!videoSupported()) {
    $("make-video").disabled = true;
    $("video-msg").textContent = "This browser cannot make videos. Open the app in the latest Chrome or Edge (at http://localhost or https), or use the PNG slides instead.";
  }
}

async function createVideo() {
  if (videoState.busy || !state.slides.length) return;
  const format = VIDEO_FORMATS.find((f) => f.id === $("video-format").value) || VIDEO_FORMATS[0];
  clearVideo();
  videoState.busy = true;
  $("make-video").disabled = true;
  $("make-video").textContent = "Creating...";
  $("video-progress").hidden = false;
  const update = (fraction) => {
    const percent = Math.round(fraction * 100);
    $("video-bar").value = percent;
    $("video-pct").textContent = `${percent}%`;
  };
  update(0);
  $("video-msg").textContent = "Keep this tab open. A 30 second video usually takes under a minute.";
  try {
    const { blob, seconds } = await makeVideo(state.slides, state.theme, format.height, update);
    videoState.blob = blob;
    videoState.url = URL.createObjectURL(blob);
    $("video-player").src = videoState.url;
    $("video-result").hidden = false;
    $("video-msg").textContent = `Done: ${Math.round(seconds)} seconds, ${(blob.size / 1e6).toFixed(1)} MB. Press play to preview.`;
  } catch (error) {
    $("video-msg").textContent = error.message === "NO_H264"
      ? "This computer cannot encode H.264 video in the browser. Try the latest Chrome or Edge, or use the PNG slides."
      : "The video could not be created. Close other heavy tabs and try again, or try another browser such as Chrome.";
  } finally {
    videoState.busy = false;
    $("make-video").disabled = !videoSupported();
    $("make-video").textContent = "Create video";
    $("video-progress").hidden = true;
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

// [11] Voice samples dialog (your past posts, used as style examples).
function openSettings() {
  $("samples").value = load("samples");
  $("settings-msg").textContent = "";
  $("settings").showModal();
}

function saveSettings(event) {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  $("settings-msg").textContent = save("samples", $("samples").value.trim())
    ? "Saved in this browser."
    : "Your browser blocked saving. Check its privacy settings.";
}

// [11b] Switch between the API keys screen and the main app.
function showScreen(name) {
  $("screen-keys").hidden = name !== "keys";
  $("screen-app").hidden = name !== "app";
  if (name === "keys") renderDashboard();
  window.scrollTo(0, 0);
}

// [12] Wire everything up.
$("generate").addEventListener("click", () => run(false));
$("demo").addEventListener("click", () => run(true));
$("open-settings").addEventListener("click", openSettings);
$("open-keys").addEventListener("click", () => showScreen("keys"));
$("settings-form").addEventListener("submit", saveSettings);
$("download-zip").addEventListener("click", exportZip);
$("make-video").addEventListener("click", createVideo);
$("download-video").addEventListener("click", () => videoState.blob && downloadBlob(videoState.blob, "carousel-video.mp4"));
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
setupVideoControls();

// [13] First screen: the API keys dashboard, unless a writing key is already saved.
migrateLegacyKey();
initDashboard({
  onContinue: () => showScreen("app"),
  onDemo: () => {
    showScreen("app");
    run(true);
  },
});
showScreen(listKeys("writing").length > 0 ? "app" : "keys");
