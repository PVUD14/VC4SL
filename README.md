# VC4SL: Voice-to-Content Engine (Phase 1)

A free, open-source personal project. Type or paste a rambling idea and get:

1. A LinkedIn post
2. Instagram carousel copy (5 to 8 slides) with live, editable previews
3. An Instagram caption with hashtags
4. Downloadable 1080x1350 PNG slides, one by one or as a ZIP
5. A downloadable **MP4 video** of the carousel (Reel/Story 9:16 or feed 4:5), made entirely in your browser

Nothing is ever posted automatically. You review, edit and copy everything yourself.

## Run it

It is a static site. No build step, no database, no backend.

```
python -m http.server 8080
```

Then open <http://localhost:8080>. (Opening `index.html` directly from disk will not work, because browsers block ES modules on `file://`.)

Click **Try demo (no key)** to see the whole app working without any account.

## Make a video

1. Generate content, edit the slides and pick a theme.
2. Open the **Video (MP4)** tab, choose a shape, press **Create video**, then **Download MP4**.

The video is H.264 MP4, 30 fps, with a slow zoom and a fade between slides. Each slide stays on screen longer when it has more words. It has no sound. A typical 30 second video takes 10 to 15 seconds to build and is about 15 MB.

It needs a recent Chrome or Edge (Safari should work too), opened from `http://localhost` or HTTPS. The video is built on your computer with the browser's own encoder. Nothing is uploaded. Timing, speed, quality and shapes are settings [13] to [19] in `js/config.js`.

For 9:16 Reels the text keeps clear of Instagram's own buttons at the top and bottom.

## Get a free key

1. Go to <https://aistudio.google.com> and create a Gemini API key (free tier).
2. In the app, open **Settings**, paste the key, and press **Save**.

The key is kept in your browser's localStorage only. It is sent to Google in a request header (`x-goog-api-key`), never in a URL, and the app never logs it.

## Make it sound like you

- Open `js/config.js`. Every setting a non-coder may want is at the top, with numbered comments: model name, handle, sign-off, voice rules, emoji and hashtag limits, slide count, themes.
- In **Settings**, paste 3 to 5 of your best past posts into "Voice samples". They are stored only in your browser and sent with each request as style examples.

## Files

| Path | What it does |
|---|---|
| `index.html` | The page and the Content-Security-Policy |
| `js/config.js` | All editable settings |
| `js/llm.js` | The single gateway to the AI (plus demo mode) |
| `js/prompts.js` | Builds the instructions sent to the AI |
| `js/render.js` | Slide building, text fitting, PNG and ZIP export |
| `js/storage.js` | Safe localStorage wrapper |
| `js/app.js` | Wires the buttons and tabs together |
| `css/app.css`, `css/slides.css` | App look and the three slide themes |
| `js/video.js` | Builds the MP4 with the browser's H.264 encoder |
| `vendor/` | `html-to-image` 1.11.13, `JSZip` 3.10.2 and `mp4-muxer` 5.2.2, copied in so the app works offline |
| `samples/` | Your private past posts (ignored by git) |
| `docs/ROADMAP.md` | Phase 2 plan |

To add another AI provider later (Groq, OpenRouter, and so on), add a function in `js/llm.js` and choose it inside `generateContent`. Nothing else needs to change.

## Privacy

- The text you type is sent to Google's Gemini API to generate content.
- On the free tier, Google may use submitted data under its own terms. Read them before you paste anything.
- Do not paste confidential or employer-sensitive material: unreleased vulnerability details, client data, internal incidents.
- Your API key and voice samples stay in your browser's localStorage. They are never part of this repository.
- Phase 2 (voice) will use the browser's speech recognition, which sends audio to the browser vendor (for example Google for Chrome).

## Responsible use

You are responsible for reviewing everything before you post it, especially anything that mentions vulnerabilities, CVEs, companies or people. The AI can be wrong, and the app is instructed never to invent facts, but it cannot guarantee that.

## Security notes

- Model output is untrusted. It is rendered with `textContent` only, never as HTML.
- A strict Content-Security-Policy allows only this site's own files and the Gemini API host. There is no `eval` and there are no inline event handlers.
- Never commit your key. `.gitignore` already excludes `.env*`, `*.key`, `node_modules` and `samples/*.txt`.

## License

MIT. See `LICENSE`. The bundled libraries keep their own MIT licenses.
