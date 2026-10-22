# VC4SL: Voice-to-Content Engine (Phase 1)

A free, open-source personal project. Type or paste a rambling idea and get:

1. A LinkedIn post
2. Instagram carousel copy (5 to 8 slides) with live, editable previews
3. An Instagram caption with hashtags
4. Downloadable 1080x1350 PNG slides, one by one or as a ZIP

Nothing is ever posted automatically. You review, edit and copy everything yourself.

## Run it

It is a static site. No build step, no database, no backend.

```
python -m http.server 8080
```

Then open <http://localhost:8080>. (Opening `index.html` directly from disk will not work, because browsers block ES modules on `file://`.)

Click **Try demo (no key)** to see the whole app working without any account.

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
| `vendor/` | `html-to-image` 1.11.13 and `JSZip` 3.10.2, copied in so the app works offline |
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
