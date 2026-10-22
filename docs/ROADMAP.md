# Roadmap

## Phase 1 (done): text to content

Idea in, LinkedIn post, carousel and caption out, with editable PNG slides. This phase exists to prove the content quality before adding voice.

## Phase 2 (planned, not built): turn-based voice interviewer

Goal: instead of typing, the user talks to an interviewer that draws the story out of them.

### How it works

- **Listening:** the browser's `SpeechRecognition`. **Speaking:** the browser's `SpeechSynthesis`. Both are free.
- **Idea map:** a checklist that fills live while the user talks. Fields: Idea, Story, Quote, Proof, Hot take, Audience. A story-strength score sits beside it.
- **Each turn:** the LLM receives the conversation and the current map, and returns the updated map plus the next question to ask.
- **Build now:** feeds the finished map into the Phase 1 generator.
- **Voice choice:** the user can pick the interviewer voice. A male, slightly deeper voice is preferred where the browser offers one.

### Honest limitations

- It is turn-based, not realtime streaming like paid voice APIs. Expect a pause after each answer.
- Speech recognition quality and available voices differ by browser and operating system. Chrome and Edge work best.
- Speech recognition sends audio to the browser vendor. The README privacy section must say so.
- Speech APIs need `http://localhost` or HTTPS, not `file://`.

### Suggested build order

1. Voice picker and a read-aloud test button.
2. Push-to-talk capture with an editable transcript.
3. Idea map schema added to `js/prompts.js`, and a second function in `js/llm.js`.
4. Interview loop, then the "Build now" hand-off to Phase 1.
