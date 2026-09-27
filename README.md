# AI StudyMate

**Learn. Test. Adapt. Master.**

An adaptive AI learning companion — not a chatbot. AI StudyMate builds a lesson for any topic at your level, tests your understanding with concept-based questions, detects exactly which concepts you missed, re-teaches them with a different strategy, and measures the improvement.

## The adaptive loop

```
LEARN → TEST → DETECT → ADAPT → RETRY → MASTER
```

1. **LEARN** — Enter any topic, level (Beginner / Intermediate / Advanced), goal and time budget. The AI returns a structured lesson: summary, key concepts, real-world connection, analogy, common mistakes.
2. **TEST** — A 5-question quiz, one question at a time. Every question is tagged with the concept it measures.
3. **DETECT** — Wrong answers are mapped back to their underlying concept, so "I got Q3 wrong" becomes "the Calvin Cycle needs another look."
4. **ADAPT** — The AI re-explains the weak concept using a *different* teaching approach (analogy, step-by-step, visual, worked example) and tells you which one it switched to.
5. **RETRY** — A brand-new question on the same concept checks whether the new explanation worked.
6. **MASTER** — Improvement is measured, not assumed, and summarized in a final learning summary with XP earned.

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + lucide-react icons
- **Backend:** Node + Express (thin AI proxy — API keys never reach the browser)
- **Persistence:** localStorage (sessions + XP), no account required
- **Testing:** Vitest

## Getting started

```bash
npm install

# Optional: add an AI provider key (see .env.example)
cp .env.example .env

# Run both the API server (:8787) and the web app (:5173)
npm run dev
```

Open http://localhost:5173

### Production build

```bash
npm run build   # builds the frontend into dist/
npm start       # serves the API + built frontend on :8787
```

## AI providers

The server auto-detects the first configured provider from `.env` (all optional):

| Provider   | Env vars |
|------------|----------|
| OpenAI     | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Gemini     | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Groq       | `GROQ_API_KEY`, `GROQ_MODEL` |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |
| Anthropic  | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |

If **no key is configured**, the server uses a built-in demo lesson engine
(a full Photosynthesis lesson + Binary Search, with adaptive explanations and
retry questions). The app is fully functional either way — ideal for demos.

The AI is asked to return strict structured JSON (lesson / adaptive-explanation /
retry-question schemas), which is validated and normalized server-side before it
reaches the UI. Malformed responses, rate limits, timeouts and network failures
all degrade gracefully to the demo engine.

## Project structure

```
├── server/
│   ├── index.js              # Express app (API + static prod serving)
│   └── routes/ai.js          # AI service: provider detection, prompts, validation, fallback
├── demo/
│   └── demoContent.json      # Built-in demo lessons (fallback content)
├── src/
│   ├── App.tsx               # Screen state machine + adaptive loop orchestration
│   ├── types.ts              # Shared domain types
│   ├── lib/
│   │   ├── api.ts            # Backend client
│   │   ├── storage.ts        # localStorage sessions + XP
│   │   ├── speech.ts         # Read-aloud (text-to-speech)
│   │   └── demoFallback.ts   # Client-side fallback (API unreachable)
│   └── components/
│       ├── ui.tsx            # Logo, AiBadge, ProgressBar
│       ├── Navbar.tsx        # Top navigation
│       ├── Landing.tsx       # Hero, how-it-works, comparison, topics
│       ├── Setup.tsx         # Topic / level / goal / time form
│       ├── Generating.tsx    # Animated loading states
│       ├── Lesson.tsx        # Lesson screen
│       ├── Quiz.tsx          # Reusable quiz engine (initial + retry)
│       ├── Analysis.tsx      # Learning snapshot (strengths + weak concepts)
│       ├── Adaptive.tsx      # AI re-teaching screen
│       ├── Retry.tsx         # Follow-up question wrapper
│       ├── Summary.tsx       # Final learning summary
│       ├── Progress.tsx      # History, stats, XP
│       └── ErrorScreen.tsx   # Friendly error handling
└── tests/
    └── extractJson.test.ts   # Unit tests for AI response parsing
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | API server + Vite dev server (concurrently) |
| `npm run build` | Type-safe production build |
| `npm start` | Serve built app + API on port 8787 |
| `npm test` | Run unit tests |
| `npm run typecheck` | TypeScript, no emit |

## Accessibility

- Semantic HTML, labelled form controls, `aria-pressed` / `role=radio` selection states
- Keyboard-friendly, visible focus rings, high-contrast text
- Correct/incorrect answers marked with icons **and** color (never color alone)
- "Read aloud" text-to-speech for lesson content
