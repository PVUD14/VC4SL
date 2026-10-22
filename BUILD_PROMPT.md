# BUILD BRIEF: Voice-to-Content Engine (Phase 1)

You are building a free, open-source web app inside the current project folder. Read this entire brief, then execute it. Do not ask questions unless something blocks you. Make reasonable decisions yourself.

---

## 1. WHAT WE ARE BUILDING

A personal-branding content tool for a cybersecurity professional (LinkedIn + Instagram).

The user types or pastes a rambling idea. The app turns it into:
1. A LinkedIn post
2. Instagram carousel copy (5 to 8 slides)
3. An Instagram caption with hashtags
4. Downloadable PNG slides rendered from HTML/CSS templates

Later (Phase 2) a turn-based voice interviewer will be added. Phase 1 proves the content quality first.

If it works well, it will be published on GitHub as a free personal project for anyone to use. Build it as a clean open-source project from day one.

---

## 2. HARD CONSTRAINTS (NON-NEGOTIABLE)

1. **Zero cost.** No paid service, no paid API, no paid hosting.
2. **No GPU.** No local model inference. No image-generation model.
3. **No backend, no database, no build step.** Static site only: plain HTML, CSS, JavaScript (ES modules). It must be deployable to GitHub Pages as-is.
4. **Bring-your-own-key.** The user pastes their own free LLM API key into a Settings panel. The key is stored only in the browser's localStorage.
5. **Never commit secrets.** No API key may ever appear in any file in the repo.
6. **Non-coder editable.** The owner is not a developer. See Section 8.

---

## 3. TECH CHOICES

- **LLM:** Google Gemini API, called directly from the browser via REST (free tier, key from aistudio.google.com).
  - Do NOT assume model names. Check the official Gemini API docs (use web search/fetch) for the current free-tier model and the correct request format before coding. Put the model name in the config file so it is one-line changeable.
  - Request JSON output (structured output / response schema) so the app gets reliable fields instead of parsing prose.
- **Provider abstraction:** put all LLM calls in one file (`js/llm.js`) behind a single function, so other providers (Groq, OpenRouter, etc.) can be added later without touching the rest of the app.
- **Slides:** HTML/CSS templates at 1080x1350 (Instagram 4:5), exported to PNG in the browser using the `html-to-image` library. Add a "Download all as ZIP" using JSZip.
  - Prefer vendoring libraries into `/vendor` (download via npm, copy the minified file) so the project works offline and has no CDN dependency. If that fails, fall back to pinned-version CDN links and say so in the report.
- **No frameworks.** Vanilla JS only.

---

## 4. PROJECT STRUCTURE

```
/
├── index.html
├── css/
│   ├── app.css            (app UI)
│   └── slides.css         (slide themes)
├── js/
│   ├── config.js          (ALL user-editable settings: voice rules, model, themes)
│   ├── llm.js             (single LLM gateway + demo mode)
│   ├── prompts.js         (system prompt builder)
│   ├── render.js          (slide rendering + PNG/ZIP export)
│   ├── storage.js         (localStorage wrapper, try/catch everywhere)
│   └── app.js             (UI wiring)
├── vendor/                (html-to-image, jszip)
├── samples/
│   └── README.md          (tells the user to drop their best past posts here as .txt)
├── docs/
│   └── ROADMAP.md         (Phase 2 voice interviewer plan)
├── README.md
├── LICENSE                (MIT)
└── .gitignore
```

---

## 5. PHASE 1 FEATURES

### 5.1 Input screen
- Large textarea: "Dump your idea. Messy is fine."
- Optional dropdowns: Post goal (Educate / Story / Hot take / Announcement), Audience (Non-technical public / Security peers / Recruiters & leaders).
- Button: **Generate**.

### 5.2 Voice profile (this is what makes output sound like the user)
- In `config.js`: a `VOICE_RULES` block (plain-English rules, e.g. tone, banned phrases, sign-off).
- In Settings: a textarea where the user pastes 3 to 5 of their best past posts as style samples (stored in localStorage). These are injected into the prompt as few-shot style examples.
- Seed `VOICE_RULES` with sensible defaults for a cybersecurity professional explaining things to non-technical people:
  - Layman terms, one real-life analogy per post.
  - Short sentences. No jargon without a one-line explanation.
  - Strong first line (hook). No "In today's fast-paced world" style filler.
  - No emojis spam (max 2). No hashtag walls (max 5).
  - Optional sign-off: "PVU Divakar" (configurable, can be switched off).
  - Never invent facts, numbers, CVE details or credentials the user did not provide.

### 5.3 Output screen (three tabs)
1. **LinkedIn post**: editable textarea + Copy button + character count.
2. **Instagram carousel**: live preview of slides, each slide's text editable inline, theme switcher (build 3 distinct themes), PNG download per slide, Download-all ZIP.
3. **Caption**: editable + Copy.

All outputs are editable before export. **No auto-posting anywhere.** Human approval is the design.

### 5.4 Slide design standard
- Premium and art-directed, not a generic template. Strong typography (use a self-hosted or system font stack; do not depend on Google Fonts at runtime), generous spacing, clear hierarchy, consistent grid.
- Slide 1 = hook, last slide = call to action, middle slides = one idea each.
- Themes: (1) dark editorial, (2) light minimal, (3) bold high-contrast. Make them genuinely different from each other.
- Text must auto-fit without overflow. Verify with long and short inputs.
- Include a small footer area with handle placeholder (editable in config).

### 5.5 Settings panel
- API key field (password input), Save, Clear.
- Model name (defaults from config).
- Voice samples textarea.
- Clear warning text: "Your key stays in this browser only. Never share it or commit it to GitHub."

### 5.6 Demo mode (required)
- A "Try demo (no key)" button that returns a canned, realistic JSON response without calling any API.
- Purpose: lets anyone try the UI instantly, and lets you test the full render pipeline without a key.

### 5.7 Error handling
- Missing key, invalid key, network failure, rate limit (HTTP 429), malformed JSON from the model, blocked/empty response.
- Every error shows a plain-English message and what to do next. Retry once on malformed JSON.

---

## 6. SECURITY REQUIREMENTS

1. Render all model output with `textContent` (never `innerHTML` with model text). Treat LLM output as untrusted.
2. Add a restrictive Content-Security-Policy `<meta>` tag (allow only self plus the Gemini API host).
3. No `eval`, no inline event handlers.
4. Never log the API key. Never put it in a URL that gets stored or shown; use the header method if the API supports it, otherwise note the trade-off in the README.
5. `.gitignore` must exclude `.env*`, `node_modules`, `*.key`, OS junk, and any `samples/*.txt` (the user's personal posts stay private).
6. README must include a Privacy section stating:
   - Text is sent to Google's Gemini API for generation.
   - Free-tier data may be used by the provider per their terms.
   - Do not paste confidential or employer-sensitive material (unreleased vulnerability details, client data, internal incidents).
   - Phase 2 will use the browser's speech recognition, which sends audio to the browser vendor.
7. Add a short "Responsible use" note: the user is responsible for reviewing content before posting, especially anything about vulnerabilities or CVEs.

---

## 7. QUALITY AND ACCESSIBILITY

- Responsive: works on laptop and mobile widths.
- Keyboard accessible, visible focus states, labels on all inputs, sufficient contrast.
- Empty, loading and error states are designed, not default.
- Premium look for the app UI as well: calm, confident, modern. Avoid cheap gradients, glow effects and obvious AI-template patterns.

---

## 8. CODE STYLE (VERY IMPORTANT)

The owner is not a coder and will edit settings by hand later.

1. Use **numbered inline comments** so any line can be referred to precisely, for example `// [1] Model name: change this if Google retires the model`, `// [2] ...`. Numbering restarts per file.
2. Put every value a non-coder might change at the TOP of `config.js`, each with a numbered comment saying what it does and safe values.
3. Plain, readable code over clever code. Small functions. No dead code.
4. Comments explain WHY and WHAT-TO-CHANGE, in simple English.

---

## 9. HOW TO WORK

1. Start by writing a short plan (10 lines max) and the list of files. Then build.
2. Run a local static server (`python -m http.server 8080` or `npx serve`). Note: browser speech APIs and some features need `http://localhost` or HTTPS, not `file://`.
3. **Validate for real.** Test in demo mode end to end: generate, edit, switch themes, export PNG, export ZIP. If a headless browser (Playwright) is available, use it to load the page, run demo mode, and check slides for text overflow with short and long text. Check the browser console for errors.
4. Never claim something works unless you actually ran it. Do not fabricate test results.
5. Do NOT build Phase 2 yet. Write `docs/ROADMAP.md` describing it (below) and stop.
6. Initialise a git repo and make a clean first commit. Do NOT push anywhere.

### Phase 2 plan (document only, for ROADMAP.md)
- Turn-based voice interviewer: browser SpeechRecognition (in) + SpeechSynthesis (out), both free.
- "Idea map" checklist that fills live as the user talks: Idea, Story, Quote, Proof, Hot take, Audience, plus a story-strength score.
- Each turn, the LLM returns the updated map plus the next question. "Build now" feeds the map into the Phase 1 generator.
- Voice should be selectable: male, slightly deeper voice preferred where the browser offers one.
- Honest limitation: not realtime streaming like paid voice APIs.

---

## 9b. DELIVERABLE REPORT (END OF YOUR WORK)

Finish with a short report in this exact shape:

- **Implemented:** list
- **Tested and verified:** list, with how you verified each
- **Not verified / needs the user:** list (for example, live Gemini call needs a real key)
- **Library versions used and whether vendored or CDN**
- **How to run it:** the exact commands
- **The user's next 3 actions**

Keep the report free of fluff.
