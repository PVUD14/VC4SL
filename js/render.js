// render.js - builds slides, fits their text, and exports PNG / ZIP.
// html-to-image and JSZip are loaded as plain scripts in index.html (window.htmlToImage, window.JSZip).
import { HANDLE, SLIDE_WIDTH, SLIDE_HEIGHT } from "./config.js";

// [1] Build one slide as a DOM element. Model text is only ever set with textContent.
//     'editable' is true in the on-screen preview and false for the hidden export copy.
//     'height' defaults to the 4:5 slide height; videos pass 1920 for 9:16.
export function buildSlide(slide, index, total, themeId, editable, height = SLIDE_HEIGHT) {
  const kind = index === 0 ? "first" : index === total - 1 ? "last" : "middle";
  const tall = height > SLIDE_HEIGHT ? " slide-tall" : "";
  const root = el("div", `slide theme-${themeId} slide-${kind}${tall}`);
  root.style.width = `${SLIDE_WIDTH}px`;
  root.style.height = `${height}px`;

  const top = el("div", "slide-top");
  top.append(el("span", "slide-count", `${pad(index + 1)} / ${pad(total)}`), el("span", "slide-rule"));

  const main = el("div", "slide-main");
  const content = el("div", "slide-content");
  const heading = el("h2", "slide-heading", slide.heading);
  const body = el("p", "slide-body", slide.body);
  content.append(heading);
  if (slide.body || editable) content.append(body);
  main.append(content);

  const footer = el("div", "slide-footer");
  footer.append(el("span", "slide-handle", HANDLE), el("span", "slide-mark", kind === "last" ? "SAVE + SHARE" : "SWIPE"));

  root.append(top, main, footer);
  if (editable) {
    makeEditable(heading, "Slide heading", false);
    makeEditable(body, "Slide text", true);
  }
  return root;
}

// [2] Shrink text until it fits. Slides use CSS variable --fit as a size multiplier.
//     The slide must already be in the page so the browser can measure it.
export function fitSlide(root) {
  const main = root.querySelector(".slide-main");
  const content = root.querySelector(".slide-content");
  let fit = 1;
  root.style.setProperty("--fit", "1");
  while (content.scrollHeight > main.clientHeight && fit > 0.35) {
    fit -= 0.03;
    root.style.setProperty("--fit", fit.toFixed(2));
  }
}

// [3] Render one slide off-screen at full size and hand it to 'capture' (a html-to-image call).
async function captureSlide(slide, index, total, themeId, height, capture) {
  const stage = el("div", "export-stage");
  const root = buildSlide(slide, index, total, themeId, false, height);
  stage.append(root);
  document.body.append(stage);
  try {
    fitSlide(root);
    return await capture(root, {
      width: SLIDE_WIDTH,
      height,
      pixelRatio: 1,
      skipFonts: true, // [3a] We use system fonts only, so nothing needs to be fetched.
    });
  } finally {
    stage.remove();
  }
}

// [3b] One slide as a PNG Blob (4:5).
export function slideToBlob(slide, index, total, themeId) {
  return captureSlide(slide, index, total, themeId, SLIDE_HEIGHT, (root, opts) => window.htmlToImage.toBlob(root, opts));
}

// [3c] One slide as a canvas of any height. Used by the video exporter.
export function slideToCanvas(slide, index, total, themeId, height) {
  return captureSlide(slide, index, total, themeId, height, (root, opts) => window.htmlToImage.toCanvas(root, opts));
}

// [4] Save a Blob as a file download.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// [5] Export every slide into one ZIP.
export async function slidesToZip(slides, themeId) {
  const zip = new window.JSZip();
  for (let i = 0; i < slides.length; i += 1) {
    zip.file(`slide-${pad(i + 1)}.png`, await slideToBlob(slides[i], i, slides.length, themeId));
  }
  return zip.generateAsync({ type: "blob" });
}

// [6] Small helpers.
function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// [7] Make a text element editable. Pasting is forced to plain text so no foreign HTML sneaks in.
function makeEditable(node, label, allowNewlines) {
  node.contentEditable = "true";
  node.spellcheck = true;
  node.setAttribute("role", "textbox");
  node.setAttribute("aria-label", label);
  node.setAttribute("aria-multiline", String(allowNewlines));
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !allowNewlines) event.preventDefault();
  });
  node.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " ");
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
