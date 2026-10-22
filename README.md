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

## API keys: bring your own, from the provider you prefer

The first screen is an **API keys** dashboard. Each card explains what that part of the app does and whether it needs a key.

| Category | Needs a key? | What it does |
|---|---|---|
| Writing AI | Yes, from any provider below | Turns your idea into the LinkedIn post, slide text and caption. The only step that calls an AI service. |
| Voice interviewer (Phase 2) | No | Not built yet. Will use the browser's own speech features. |
| Slides, PNG and video | No | Made on your own computer. |

### Choose your Writing AI provider

| Provider | Cost | Default model | Where to get a key |
|---|---|---|---|
| Google Gemini | Free tier | `gemini-3.5-flash-lite` | <https://aistudio.google.com/apikey> |
| Groq | Free tier | `openai/gpt-oss-20b` | <https://console.groq.com/keys> |
| OpenRouter | Has free models | `openrouter/free` | <https://openrouter.ai/keys> |
| OpenAI | Paid, billed to you | `gpt-6-luna` | <https://platform.openai.com/api-keys> |
| Anthropic Claude | Paid, billed to you | `claude-haiku-5-5` | <https://console.anthropic.com/settings/keys> |
| Local server (Ollama, LM Studio) | Free, runs on your computer | none, you type the model you installed | <https://ollama.com/download> |

Pick a provider, paste your key, and optionally type a model name. Model names change often. If a provider says a model is unknown, put a current name in the Model box.

You can add **several keys, even from different providers**. They are tried from top to bottom, and if one hits a limit, runs out of credit or is rejected, the app moves to the next and tells you. Use the up and down arrows to change the order. Use **Test** to check a key works. Use **API keys** in the header to return to this screen at any time.

**Local server:** run Ollama or LM Studio, download a model, and add it with the address of the server (default `http://localhost:11434/v1`). No key is needed. Ollama must allow browser access, for example by setting the `OLLAMA_ORIGINS` environment variable to the address you open this app from. Only `localhost` addresses are accepted.

**Adding another provider:** add an entry to the providers list in `js/config.js` (setting [21]) and add its web address to `connect-src` in the Content-Security-Policy in `index.html`. Any service that follows the common "openai" chat format will work with `kind: "openai"`.

### Token counter

The bar at the bottom shows tokens used per key: today, in total, and the number of requests. It adds up the counts Google returns with each reply. These are good estimates for this browser only. They are not Google's official quota figures, and they do not include use of the same key elsewhere. The demo does not use any tokens. **Reset counts** zeroes them.

Keys are kept in your browser's localStorage only. They are sent to Google in a request header (`x-goog-api-key`), never in a URL, shown only as the last four characters, and never logged.

## Make it sound like you

- Open `js/config.js`. Every setting a non-coder may want is at the top, with numbered comments: model name, handle, sign-off, voice rules, emoji and hashtag limits, slide count, themes.
- Under **Voice samples** in the header, paste 3 to 5 of your best past posts. They are stored only in your browser and sent with each request as style examples.

## Files

| Path | What it does |
|---|---|
| `index.html` | The page and the Content-Security-Policy |
| `js/config.js` | All editable settings |
| `js/llm.js` | The single gateway to every AI provider (plus demo mode) |
| `js/prompts.js` | Builds the instructions sent to the AI |
| `js/render.js` | Slide building, text fitting, PNG and ZIP export |
| `js/storage.js` | Safe localStorage wrapper |
| `js/keys.js` | Key vault and token counting |
| `js/dashboard.js` | The API keys screen and the bottom token bar |
| `js/app.js` | Wires the buttons and tabs together |
| `css/app.css`, `css/slides.css` | App look and the three slide themes |
| `js/video.js` | Builds the MP4 with the browser's H.264 encoder |
| `vendor/` | `html-to-image` 1.11.13, `JSZip` 3.10.2 and `mp4-muxer` 5.2.2, copied in so the app works offline |
| `samples/` | Your private past posts (ignored by git) |
| `docs/ROADMAP.md` | Phase 2 plan |

To add another AI provider later (Groq, OpenRouter, and so on), add a function in `js/llm.js` and choose it inside `generateContent`. Nothing else needs to change.

## Privacy

- The text you type is sent to the provider you choose (Google, Groq, OpenRouter, OpenAI or Anthropic) to generate content. With a local server it stays on your computer.
- Free tiers may let the provider use submitted data under its own terms. Read the terms of the provider you pick before you paste anything.
- Do not paste confidential or employer-sensitive material: unreleased vulnerability details, client data, internal incidents.
- Your API keys, token counts and voice samples stay in your browser's localStorage. They are never part of this repository.
- Phase 2 (voice) will use the browser's speech recognition, which sends audio to the browser vendor (for example Google for Chrome).

## Responsible use

You are responsible for reviewing everything before you post it, especially anything that mentions vulnerabilities, CVEs, companies or people. The AI can be wrong, and the app is instructed never to invent facts, but it cannot guarantee that.

## Security notes

- Model output is untrusted. It is rendered with `textContent` only, never as HTML.
- A strict Content-Security-Policy allows only this site's own files, the listed AI providers, and `localhost`. There is no `eval` and there are no inline event handlers.
- Never commit your key. `.gitignore` already excludes `.env*`, `*.key`, `node_modules` and `samples/*.txt`.

## License

MIT. See `LICENSE`. The bundled libraries keep their own MIT licenses.
