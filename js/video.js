// video.js - turns the slides into an MP4 inside the browser (no server, no cost).
// How: each slide is drawn to a picture, then we animate (slow zoom + fade between slides),
// feed every frame to the browser's built-in H.264 encoder, and pack the result into an MP4 file.
// mp4-muxer is loaded as a plain script in index.html (window.Mp4Muxer).
import {
  SLIDE_WIDTH, VIDEO_FPS, VIDEO_MIN_SECONDS, VIDEO_SECONDS_PER_WORD, VIDEO_MAX_SECONDS, VIDEO_FADE_SECONDS, VIDEO_MBPS,
} from "./config.js";
import { slideToCanvas } from "./render.js";

// [1] H.264 profile/level strings to try, best first. The first one this computer supports wins.
const CODECS = ["avc1.64002A", "avc1.640028", "avc1.4D0028"];

// [2] Can this browser make videos at all? Needs a recent Chrome, Edge or Safari on localhost or HTTPS.
export function videoSupported() {
  return typeof window.VideoEncoder === "function" && typeof window.VideoFrame === "function" && Boolean(window.Mp4Muxer);
}

// [3] How long each slide stays on screen: longer text stays longer, within the limits in config.js.
export function slideSeconds(slide) {
  const words = `${slide.heading} ${slide.body}`.trim().split(/\s+/).filter(Boolean).length;
  const seconds = VIDEO_MIN_SECONDS + words * VIDEO_SECONDS_PER_WORD;
  return Math.min(VIDEO_MAX_SECONDS, Math.max(VIDEO_MIN_SECONDS, seconds));
}

// [4] Pick an H.264 setting this computer can encode, or return null.
async function pickCodec(width, height) {
  for (const codec of CODECS) {
    const config = { codec, width, height, bitrate: VIDEO_MBPS * 1e6, framerate: VIDEO_FPS };
    try {
      if ((await window.VideoEncoder.isConfigSupported(config)).supported) return config;
    } catch {
      // Try the next profile.
    }
  }
  return null;
}

// [5] Make the video. 'onProgress' gets a number from 0 to 1. Returns { blob, seconds }.
export async function makeVideo(slides, themeId, height, onProgress) {
  const config = await pickCodec(SLIDE_WIDTH, height);
  if (!config) throw new Error("NO_H264");

  // [5a] Draw every slide once, up front.
  const pictures = [];
  for (let i = 0; i < slides.length; i += 1) {
    pictures.push(await slideToCanvas(slides[i], i, slides.length, themeId, height));
    onProgress((i + 1) / slides.length * 0.15);
  }

  // [5b] Work out when each slide starts.
  const lengths = slides.map(slideSeconds);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const totalSeconds = lengths.reduce((a, b) => a + b, 0);
  const totalFrames = Math.round(totalSeconds * VIDEO_FPS);

  // [5c] Set up the MP4 packer and the encoder.
  const muxer = new window.Mp4Muxer.Muxer({
    target: new window.Mp4Muxer.ArrayBufferTarget(),
    video: { codec: "avc", width: SLIDE_WIDTH, height },
    fastStart: "in-memory",
  });
  let encodeError = null;
  const encoder = new window.VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encodeError = e; },
  });
  encoder.configure(config);

  // [5d] Draw and encode frame by frame.
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  for (let frame = 0; frame < totalFrames; frame += 1) {
    if (encodeError) throw encodeError;
    drawFrame(ctx, pictures, starts, lengths, frame / VIDEO_FPS, height);
    const videoFrame = new window.VideoFrame(canvas, { timestamp: Math.round((frame * 1e6) / VIDEO_FPS) });
    encoder.encode(videoFrame, { keyFrame: frame % (VIDEO_FPS * 2) === 0 });
    videoFrame.close();
    if (encoder.encodeQueueSize > 8 || frame % 6 === 0) {
      // [5e] Give the encoder and the page a moment to breathe, and update the progress bar.
      await new Promise((resolve) => setTimeout(resolve, 0));
      onProgress(0.15 + (frame / totalFrames) * 0.85);
    }
  }
  await encoder.flush();
  if (encodeError) throw encodeError;
  encoder.close();
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), seconds: totalSeconds };
}

// [6] Paint one moment of the video: the current slide with a slow zoom, fading into the next.
function drawFrame(ctx, pictures, starts, lengths, time, height) {
  let index = pictures.length - 1;
  while (index > 0 && time < starts[index]) index -= 1;
  const local = time - starts[index];
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SLIDE_WIDTH, height);
  paint(ctx, pictures[index], local / lengths[index], height, 1);
  const untilEnd = lengths[index] - local;
  if (index < pictures.length - 1 && VIDEO_FADE_SECONDS > 0 && untilEnd < VIDEO_FADE_SECONDS) {
    paint(ctx, pictures[index + 1], 0, height, 1 - untilEnd / VIDEO_FADE_SECONDS);
  }
}

// [7] Draw a picture with a gentle zoom from 100% to 104% as 'progress' goes from 0 to 1.
function paint(ctx, picture, progress, height, alpha) {
  const zoom = 1 + 0.04 * progress;
  const w = SLIDE_WIDTH * zoom;
  const h = height * zoom;
  ctx.globalAlpha = alpha;
  ctx.drawImage(picture, (SLIDE_WIDTH - w) / 2, (height - h) / 2, w, h);
  ctx.globalAlpha = 1;
}
