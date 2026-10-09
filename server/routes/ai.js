/**
 * AI StudyMate — AI service layer (server-side only).
 *
 * Auto-detects every configured provider from environment variables and
 * fails over across them (e.g. Groq → Gemini) with retries per provider.
 * If every provider fails (or none is configured), a built-in demo lesson
 * engine silently takes over so the app always works — critical for the
 * live hackathon demo.
 */

const env = process.env;

const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    keyVar: 'OPENAI_API_KEY',
    modelVar: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    buildRequest: (key, model, system, user) => ({
      url: 'https://api.openai.com/v1/chat/completions',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      },
    }),
  },
  {
    id: 'groq',
    label: 'Groq',
    keyVar: 'GROQ_API_KEY',
    modelVar: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
    buildRequest: (key, model, system, user) => ({
      url: 'https://api.groq.com/openai/v1/chat/completions',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      },
    }),
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyVar: 'OPENROUTER_API_KEY',
    modelVar: 'OPENROUTER_MODEL',
    defaultModel: 'openai/gpt-4o-mini',
    buildRequest: (key, model, system, user) => ({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'AI StudyMate',
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      },
    }),
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyVar: 'GEMINI_API_KEY',
    modelVar: 'GEMINI_MODEL',
    defaultModel: 'gemini-1.5-flash',
    buildRequest: (key, model, system, user) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
        }),
      },
    }),
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    keyVar: 'ANTHROPIC_API_KEY',
    modelVar: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-3-5-haiku-latest',
    buildRequest: (key, model, system, user) => ({
      url: 'https://api.anthropic.com/v1/messages',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: system + '\nRespond with ONLY the raw JSON object.',
          messages: [{ role: 'user', content: user }],
        }),
      },
    }),
  },
];

/** All providers with a configured key, in built-in priority order. */
function detectProviders() {
  return PROVIDERS.filter((p) => {
    const key = env[p.keyVar];
    return key && key.trim();
  }).map((p) => ({
    ...p,
    key: env[p.keyVar].trim(),
    model: (env[p.modelVar] || p.defaultModel).trim(),
  }));
}

function detectProvider() {
  return detectProviders()[0] ?? null;
}

export function aiStatus() {
  const providers = detectProviders();
  if (providers.length === 0) {
    return { configured: false, provider: 'demo', model: 'Demo Engine', label: 'Demo Engine' };
  }
  // Show only the primary model when a rotation list is configured.
  const primary = providers[0];
  const displayModel = String(primary.model).split(',')[0].trim();
  return {
    configured: true,
    provider: primary.id,
    model: displayModel,
    label: primary.label,
    ...(providers.length > 1 ? { backup: providers[1].label } : {}),
  };
}

/** Robustly extract a JSON object from an LLM response. */
export function extractJson(text) {
  if (!text) throw new Error('Empty AI response');
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('No JSON found in AI response');
}

/** Rotate through a comma-separated model list across retry attempts. */
function pickModel(provider, attempt) {
  const models = String(provider.model || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length === 0) return provider.model;
  return models[(attempt - 1) % models.length];
}

export async function callLLM(system, user) {
  const providers = detectProviders();
  if (providers.length === 0) throw new Error('NO_PROVIDER');

  // Free-tier providers often return transient 429/5xx capacity errors —
  // retry each provider with a short backoff, then fail over to the next
  // configured provider. Model lists (comma-separated) rotate per retry
  // so a busy capacity pool on one model doesn't sink the call.
  const RETRYABLE = new Set([429, 500, 502, 503, 504]);
  const MAX_ATTEMPTS_PER_PROVIDER = 2;
  let lastErr = new Error('LLM call failed');

  for (const provider of providers) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
      const model = pickModel(provider, attempt);
      const { url, init } = provider.buildRequest(provider.key, model, system, user);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          const err = new Error(`Provider ${provider.id} returned ${res.status}: ${body.slice(0, 300)}`);
          err.status = res.status;
          throw err;
        }
        const data = await res.json();
        const text =
          provider.id === 'gemini'
            ? (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
            : (data?.choices?.[0]?.message?.content ?? '');
        if (text.trim()) return text;
        throw new Error(`Provider ${provider.id} returned an empty response`);
      } catch (err) {
        lastErr = err;
        const retryable = RETRYABLE.has(err.status) || err.status === undefined;
        if (!retryable || attempt === MAX_ATTEMPTS_PER_PROVIDER) break; // next provider
        await new Promise((r) => setTimeout(r, attempt * 1000));
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw lastErr;
}

/**
 * Vision call: multimodal analysis of image frames (data URLs).
 * Uses Gemini (the only vision-capable provider currently configured) and
 * falls back gracefully; SKILLFORGE treats vision output as OBSERVATIONS,
 * never as verdicts or scores.
 */
export async function callVision(system, user, imageDataUrls) {
  const key = (env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim();
  if (!key) throw new Error('NO_VISION_PROVIDER');
  const model = (env.GEMINI_VISION_MODEL || env.GEMINI_MODEL || 'gemini-1.5-flash').trim().split(',')[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const parts = [{ text: user }];
  for (const dataUrl of (imageDataUrls || []).slice(0, 3)) {
    const m = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i.exec(String(dataUrl));
    if (m) parts.push({ inline_data: { mime_type: `image/${m[1].toLowerCase()}`, data: m[2] } });
  }
  if (parts.length === 1) throw new Error('NO_IMAGE_DATA');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini vision returned ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text.trim()) throw new Error('Empty vision response');
    return { text, model };  } finally {
    clearTimeout(timer);
  }
}

export const SYSTEM_PROMPT = `You are an adaptive educational tutor inside an app called AI StudyMate.

Your job is to teach the requested topic at the learner's selected level.
Do not simply dump information. Explain concepts clearly and progressively.
Use simple language for beginners, appropriate technical depth for intermediate learners, and deeper reasoning, terminology and richer examples for advanced learners.
If the learner gives a learning goal (understand basics, exam prep, quick revision, or mastery), shape the lesson depth and tone toward that goal.

Generate questions that test conceptual understanding, not memorization.
Each quiz question MUST be associated with exactly one concept from keyConcepts.
If the learner answers incorrectly, identify the concept they struggled with and provide an alternative explanation using a DIFFERENT teaching approach (simple language, real-world analogy, step-by-step breakdown, visual-style description, or worked example).
Never shame the learner for mistakes. Encourage learning from errors.

Always respond with ONLY a valid JSON object matching the requested schema. No markdown fences, no commentary.`;

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const GOALS = ['Understand the basics', 'Prepare for an exam', 'Revise quickly', 'Master the concept'];
const TIME_BUDGETS = ['5', '10', '15'];

/**
 * Depth profiles: scale lesson size and rigor with the learner's level and
 * goal. Beginner basics stays light; Advanced or exam-prep gets far more
 * concepts, deeper explanations, longer quizzes and exam-style difficulty.
 */
function getDepthProfile(level, goal, time) {
  const profile = {
    conceptMin: 3,
    conceptMax: 5,
    conceptSentences: '2-3 sentences each',
    quizCount: 5,
    depthDirective:
      'Use plain language and everyday analogies. Define every technical term the first time it appears. Keep the math out unless it is truly essential.',
    quizDirective: 'Questions must test understanding, not memorization, and must match the level.',
  };

  if (level === 'Intermediate') {
    Object.assign(profile, {
      conceptMin: 4,
      conceptMax: 6,
      conceptSentences: '3-5 sentences each, including how ideas connect and where they break down',
      quizCount: 7,
      depthDirective:
        'Assume solid basic knowledge. Include practical depth: trade-offs, mechanisms, why-it-works reasoning, and light quantitative reasoning where natural.',
      quizDirective:
        'Questions must test understanding and application — include at least two questions that require reasoning, not recall — and must match the level.',
    });
  }

  if (level === 'Advanced') {
    Object.assign(profile, {
      conceptMin: 5,
      conceptMax: 8,
      conceptSentences:
        '4-6 sentences each with full technical rigor: formal terminology, underlying mechanisms, edge cases, and formulas/derivations where applicable',
      quizCount: 10,
      depthDirective:
        'Write for a technically fluent learner: use precise formal terminology, cover underlying mechanisms and edge cases, include relevant formulas, derivations or proofs, and address graduate-level misconceptions. Explanations may be long and dense. No dumbing down.',
      quizDirective:
        'Questions must be genuinely hard: multi-step quantitative problems, edge cases, near-miss distractors that differ only subtly, and questions where superficial understanding gives a wrong answer. They must match the level — NOT be answerable from the summary alone.',
    });
  }

  // Goals adjust on top of the level baseline.
  if (goal === 'Prepare for an exam') {
    profile.quizCount = Math.max(profile.quizCount, level === 'Beginner' ? 7 : profile.quizCount);
    profile.quizDirective +=
      ' Phrase questions like real exam items: application, analysis, and multi-step reasoning with plausible near-miss distractors.';
    profile.conceptMax += 1;
  }
  if (goal === 'Master the concept') {
    profile.depthDirective +=
      ' Push toward mastery: explain not just what is true but WHY, and flag the subtle points that distinguish experts from casual learners.';
    profile.quizDirective +=
      ' Include at least two questions that apply the concept to a novel scenario the learner has not seen.';
  }
  // "Revise quickly" intentionally keeps the level baseline — respect the speed request.

  // Short time budget trims the scope back down.
  if (time === '5') {
    profile.conceptMax = Math.min(profile.conceptMax, 5);
    profile.quizCount = Math.min(profile.quizCount, 6);
  }

  return profile;
}

const APPROACHES = [
  'Simple explanation',
  'Real-world analogy',
  'Step-by-step breakdown',
  'Visual-style text explanation',
  'Example-based explanation',
];

function str(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

/** Validate + normalize a lesson object; throws if unusable. */
function validateLesson(raw, topic, profile) {
  // Depth profile scales the caps; defaults here preserve old behavior.
  const p = profile || { conceptMin: 3, conceptMax: 6, quizCount: 6 };
  if (!raw || typeof raw !== 'object') throw new Error('Lesson is not an object');
  if (!Array.isArray(raw.keyConcepts) || raw.keyConcepts.length < Math.min(2, p.conceptMin))
    throw new Error('Lesson has too few concepts');
  if (!Array.isArray(raw.quiz) || raw.quiz.length < 3) throw new Error('Lesson has too few quiz questions');

  // Salvage every valid concept/question instead of discarding the whole
  // lesson over one malformed item (bigger AI outputs have higher odds of
  // a single glitch — dropping it beats falling back to demo).
  const keyConcepts = raw.keyConcepts
    .slice(0, Math.max(6, p.conceptMax))
    .map((c) => ({
      title: str(c?.title),
      explanation: str(c?.explanation),
    }))
    .filter((c) => c.title && c.explanation);
  if (keyConcepts.length < Math.min(2, p.conceptMin)) throw new Error('Lesson has too few usable concepts');

  const quiz = [];
  if (Array.isArray(raw.quiz)) {
    for (const q of raw.quiz.slice(0, Math.max(6, p.quizCount))) {
      const options = Array.isArray(q?.options) ? q.options.map((o) => String(o)).slice(0, 4) : [];
      const idx = Number(q?.correctAnswer);
      const question = str(q?.question);
      if (options.length !== 4 || options.some((o) => !o.trim())) continue;
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
      if (!question) continue;
      quiz.push({
        question,
        options,
        correctAnswer: idx,
        concept: str(q?.concept, keyConcepts[0]?.title || topic),
        explanation: str(q?.explanation),
      });
    }
  }
  if (quiz.length < 3) throw new Error('Lesson has too few usable quiz questions');

  return {
    source: raw.source === 'demo' ? 'demo' : 'ai',
    model: str(raw.model, 'AI Tutor'),
    topic: str(raw.topic, topic),
    level: str(raw.level, 'Beginner'),
    goal: str(raw.goal),
    summary: str(raw.summary),
    keyConcepts,
    realWorldExample: str(raw.realWorldExample),
    analogy: str(raw.analogy),
    commonMistakes: Array.isArray(raw.commonMistakes)
      ? raw.commonMistakes.map((m) => String(m)).filter((m) => m.trim()).slice(0, 5)
      : [],
    quiz,
  };
}

/** Validate + normalize an adaptive explanation payload. */
function validateAdapt(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Adaptation is not an object');
  const approach = APPROACHES.includes(raw.approach) ? raw.approach : APPROACHES[0];
  const result = {
    concept: str(raw.concept),
    approach,
    approachLabel: approach,
    explanation: str(raw.explanation),
    keyIdea: str(raw.keyIdea),
  };
  if (!result.explanation || !result.keyIdea) throw new Error('Malformed adaptive explanation');
  return result;
}

/** Validate + normalize a teach-back analysis payload. */
function validateTeachBack(raw, topic, level, fallbackQuestions) {
  if (!raw || typeof raw !== 'object') throw new Error('Teach-back is not an object');
  const list = (v) =>
    Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s.trim()).slice(0, 6) : [];
  const result = {
    correctly_understood: list(raw.correctly_understood),
    partially_understood: list(raw.partially_understood),
    misconceptions: list(raw.misconceptions),
    missing_concepts: list(raw.missing_concepts),
    overall_understanding: Math.max(0, Math.min(100, Math.round(Number(raw.overall_understanding) || 0))),
    biggest_learning_gap: str(raw.biggest_learning_gap, ''),
    targeted_explanation: str(raw.targeted_explanation, ''),
    follow_up_questions: [],
  };
  if (Array.isArray(raw.follow_up_questions)) {
    result.follow_up_questions = raw.follow_up_questions
      .slice(0, 3)
      .map((q) => {
        try {
          return validateRetryQuestion(q, str(q?.concept, ''));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
  if (result.follow_up_questions.length === 0 && fallbackQuestions.length > 0) {
    result.follow_up_questions = fallbackQuestions;
  }
  return result;
}

/** Validate + normalize a review pack. */
function validateReviewPack(raw, topic, concepts) {
  if (!raw || typeof raw !== 'object') throw new Error('Review pack is not an object');
  const questions = [];
  if (Array.isArray(raw.questions)) {
    for (const q of raw.questions.slice(0, 4)) {
      try {
        questions.push(validateRetryQuestion(q, str(q?.concept, concepts[0] || topic)));
      } catch {
        /* skip malformed questions */
      }
    }
  }
  if (questions.length === 0) throw new Error('Review pack has no valid questions');
  return {
    topic: str(raw.topic, topic),
    focusConcepts: Array.isArray(raw.focusConcepts)
      ? raw.focusConcepts.map((c) => String(c)).filter((c) => c.trim()).slice(0, 4)
      : concepts,
    questions,
    intro: str(raw.intro, `A focused review of ${concepts.join(', ')}.`),
  };
}

/** Validate + normalize a retry question. */
function validateRetryQuestion(raw, concept) {
  const options = Array.isArray(raw?.options) ? raw.options.map((o) => String(o)).slice(0, 4) : [];
  if (options.length !== 4 || options.some((o) => !o.trim())) throw new Error('Retry question has bad options');
  const idx = Number(raw?.correctAnswer);
  if (!Number.isInteger(idx) || idx < 0 || idx > 3) throw new Error('Retry question has bad correctAnswer');
  const q = {
    question: str(raw?.question),
    options,
    correctAnswer: idx,
    concept: str(raw?.concept, concept),
    explanation: str(raw?.explanation),
  };
  if (!q.question) throw new Error('Malformed retry question');
  return q;
}

// ---------------------------------------------------------------------------
// Demo engine (silent fallback — keeps the live demo bulletproof)
// ---------------------------------------------------------------------------

function normalizeTopic(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

import demoData from '../../demo/demoContent.json' with { type: 'json' };

function getDemoLesson(topic, level, goal, time) {
  const t = normalizeTopic(topic);
  const match =
    demoData.lessons.find((l) => normalizeTopic(l.topic) === t) ||
    demoData.lessons.find((l) => t.includes(normalizeTopic(l.topic)) || normalizeTopic(l.topic).includes(t));
  const base = match || demoData.lessons[0];
  const lesson = {
    ...structuredClone(base),
    topic: topic.trim() || base.topic,
    level,
    goal: goal || '',
    timeMinutes: time || null,
  };
  lesson.model = 'Demo Engine';
  if (level === 'Advanced') {
    lesson.summary += ' At an advanced level, focus on the quantitative relationships and edge cases behind each idea.';
  } else if (level === 'Intermediate') {
    lesson.summary += ' At this level, connect each idea to how it is used in practice.';
  }
  return lesson;
}

function getDemoAdapt(concept, topic) {
  const t = normalizeTopic(topic);
  const lesson =
    demoData.lessons.find((l) => normalizeTopic(l.topic) === t) ||
    demoData.lessons.find((l) => t.includes(normalizeTopic(l.topic)) || normalizeTopic(l.topic).includes(t));
  const pool = lesson ? lesson.adaptive : demoData.lessons[0].adaptive;
  const hit = pool.find((a) => normalizeTopic(a.concept) === normalizeTopic(concept));
  return hit || pool[0];
}

function shuffleOptions(question) {
  const correct = question.options[question.correctAnswer];
  const options = [...question.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...question, options, correctAnswer: options.indexOf(correct) };
}

function getDemoRetry(concept, topic) {
  const t = normalizeTopic(topic);
  const lesson =
    demoData.lessons.find((l) => normalizeTopic(l.topic) === t) ||
    demoData.lessons.find((l) => t.includes(normalizeTopic(l.topic)) || normalizeTopic(l.topic).includes(t));
  const pool = lesson ? lesson.retryQuestions : demoData.lessons[0].retryQuestions;
  const hit = pool.find((q) => normalizeTopic(q.concept) === normalizeTopic(concept));
  const q = hit || pool[0];
  return shuffleOptions(structuredClone(q));
}

/** Demo teach-back analysis: keyword-based heuristic over the built-in lesson. */
function getDemoTeachBack(topic, explanation, keyConcepts) {
  const lesson =
    demoData.lessons.find((l) => normalizeTopic(l.topic) === normalizeTopic(topic)) ||
    demoData.lessons[0];
  const text = normalizeTopic(explanation);
  const hit = (c) => {
    const words = normalizeTopic(c).split(' ').filter((w) => w.length > 3);
    return words.some((w) => text.includes(w));
  };

  const correctly = [];
  const missing = [];
  for (const c of lesson.keyConcepts) {
    if (hit(c.title)) correctly.push(c.title);
    else missing.push(c.title);
  }
  // Heuristic misconception checks (demo content only)
  const misconceptions = [];
  if (/plants? (eat|drink|take) (food|soil)/.test(text)) misconceptions.push('Plants do not "eat" soil — mass comes from carbon dioxide in the air.');
  if (/glucose.{0,30}oxygen.{0,30}(same|input)/.test(text) || /oxygen is (the|an) (input|product they use)/.test(text)) misconceptions.push('Oxygen is an output, not an input.');
  if (/calvin.{0,40}(needs? (light|sunlight))/.test(text) && !/does not need light directly/.test(text)) misconceptions.push('The Calvin Cycle does not use light directly — it runs on ATP and NADPH.');

  const gap = misconceptions[0] || missing[0] || 'the exact role of each input and output';
  const overall = Math.max(10, Math.min(95, 35 + correctly.length * 15 - misconceptions.length * 10));

  const gapConcept = lesson.adaptive.find((a) => normalizeTopic(a.concept) === normalizeTopic(gap)) || lesson.adaptive[0];

  return {
    correctly_understood: correctly,
    partially_understood: [],
    misconceptions,
    missing_concepts: missing,
    overall_understanding: overall,
    biggest_learning_gap: gap,
    targeted_explanation: gapConcept
      ? `${gapConcept.explanation} ${gapConcept.keyIdea ? `Key idea: ${gapConcept.keyIdea}` : ''}`.trim()
      : `Review the lesson's key concepts on ${lesson.topic}, then try explaining it again — you're close.`,
    follow_up_questions: lesson.retryQuestions.slice(0, 2).map((q) => shuffleOptions(structuredClone(q))),
  };
}

/** Demo review pack: reuses the built-in retry questions for weak concepts. */
function getDemoReview(topic, concepts) {
  const lesson =
    demoData.lessons.find((l) => normalizeTopic(l.topic) === normalizeTopic(topic)) ||
    demoData.lessons[0];
  const wanted = concepts.map((c) => normalizeTopic(c));
  let questions = lesson.retryQuestions.filter((q) => wanted.includes(normalizeTopic(q.concept)));
  if (questions.length === 0) questions = lesson.retryQuestions.slice(0, 3);
  questions = questions.slice(0, 3).map((q) => shuffleOptions(structuredClone(q)));
  return {
    topic: lesson.topic,
    focusConcepts: concepts,
    intro: `A quick refresher on ${concepts.join(', ')} — the concepts your results suggest reviewing first.`,
    questions,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

import { Router } from 'express';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ ...aiStatus(), demo: !aiStatus().configured });
});

router.post('/lesson', async (req, res) => {
  const topic = str(req.body?.topic);
  const level = LEVELS.includes(req.body?.level) ? req.body.level : 'Beginner';
  const goal = GOALS.includes(req.body?.goal) ? req.body.goal : '';
  const time = TIME_BUDGETS.includes(String(req.body?.time)) ? String(req.body.time) : null;

  if (!topic) {
    return res.status(400).json({ error: 'Please enter a topic you want to learn.' });
  }

  // Depth scales with level + goal: bigger lessons, deeper prose, harder quizzes.
  const depth = getDepthProfile(level, goal, time);

  const userPrompt = `Teach this topic: "${topic}".
Learner level: ${level}.
${goal ? `Learning goal: ${goal}.` : ''}
${time ? `Time budget: about ${time} minutes.` : ''}

Depth requirement: ${depth.depthDirective}

Return JSON with EXACTLY this shape:
{
  "topic": string (the topic, cleaned up),
  "summary": string (2-4 sentence overview at the learner's level),
  "keyConcepts": array of ${depth.conceptMin}-${depth.conceptMax} objects: { "title": string, "explanation": string (${depth.conceptSentences}) },
  "realWorldExample": string (where/how this shows up in real life),
  "analogy": string (one vivid everyday analogy),
  "commonMistakes": array of 3-4 short strings (mistakes students commonly make with this topic),
  "quiz": array of exactly ${depth.quizCount} objects: {
    "question": string,
    "options": array of exactly 4 strings,
    "correctAnswer": integer index 0-3,
    "concept": string (MUST match one of the keyConcepts titles),
    "explanation": string (why the correct answer is right, 1-2 sentences)
  }
}
${depth.quizDirective}
COUNT CHECK: keyConcepts must contain between ${depth.conceptMin} and ${depth.conceptMax} items, and quiz must contain exactly ${depth.quizCount} items. Count them before answering.`;

  try {
    const text = await callLLM(SYSTEM_PROMPT, userPrompt);
    const raw = extractJson(text);
    raw.source = 'ai';
    raw.model = aiStatus().model;
    raw.level = level;
    if (goal) raw.goal = goal;
    const lesson = validateLesson(raw, topic, depth);
    res.json(lesson);
  } catch (err) {
    console.error('[lesson] AI call failed, using demo fallback:', err.message);
    res.json(getDemoLesson(topic, level, goal, time));
  }
});

router.post('/adapt', async (req, res) => {
  const topic = str(req.body?.topic);
  const level = LEVELS.includes(req.body?.level) ? req.body.level : 'Beginner';
  const concept = str(req.body?.concept);
  const question = str(req.body?.question);
  const correctAnswer = str(req.body?.correctAnswer);
  const chosen = str(req.body?.chosen);

  if (!concept) return res.status(400).json({ error: 'Missing concept to adapt.' });

  const userPrompt = `A student is learning "${topic}" at ${level} level.
They answered this question WRONG:
Question: ${question}
They chose: ${chosen || '(no answer)'}
Correct answer: ${correctAnswer}

The weak concept behind this question is: "${concept}".

Create an alternative explanation of that concept using a DIFFERENT teaching approach than a plain textbook definition. Pick ONE approach from: ${APPROACHES.map((a) => `"${a}"`).join(', ')} — whichever is most vivid for this concept at ${level} level.
Be encouraging, never condescending.

Return JSON with EXACTLY this shape:
{
  "concept": "${concept}",
  "approach": one of the approach strings above,
  "explanation": string (3-5 sentences using the chosen approach),
  "keyIdea": string (one crisp sentence: the key idea to remember)
}`;

  try {
    const text = await callLLM(SYSTEM_PROMPT, userPrompt);
    const raw = extractJson(text);
    res.json(validateAdapt(raw));
  } catch (err) {
    console.error('[adapt] AI call failed, using demo fallback:', err.message);
    res.json(getDemoAdapt(concept, topic));
  }
});

router.post('/retry', async (req, res) => {
  const topic = str(req.body?.topic);
  const level = LEVELS.includes(req.body?.level) ? req.body.level : 'Beginner';
  const concept = str(req.body?.concept);
  const avoidedQuestion = str(req.body?.previousQuestion);

  if (!concept) return res.status(400).json({ error: 'Missing concept for retry question.' });

  const userPrompt = `A student is learning "${topic}" at ${level} level.
They just struggled with the concept "${concept}", received a new adaptive explanation, and now you want to check if it helped.
Create ONE new multiple-choice question that tests the SAME concept "${concept}" from a different angle.${avoidedQuestion ? ` Do NOT repeat or trivially rephrase this previous question: "${avoidedQuestion}"` : ''}
It must be answerable using the new explanation, and match ${level} level.

Return JSON with EXACTLY this shape:
{
  "question": string,
  "options": array of exactly 4 strings,
  "correctAnswer": integer index 0-3,
  "concept": "${concept}",
  "explanation": string (why the correct answer is right, 1-2 sentences)
}`;

  try {
    const text = await callLLM(SYSTEM_PROMPT, userPrompt);
    const raw = extractJson(text);
    res.json(validateRetryQuestion(raw, concept));
  } catch (err) {
    console.error('[retry] AI call failed, using demo fallback:', err.message);
    res.json(getDemoRetry(concept, topic));
  }
});

// ---------------------------------------------------------------------------
// Intelligence layer (additive routes — existing endpoints above are untouched)
// ---------------------------------------------------------------------------

router.post('/teachback', async (req, res) => {
  const topic = str(req.body?.topic);
  const level = LEVELS.includes(req.body?.level) ? req.body.level : 'Beginner';
  const explanation = str(req.body?.explanation);
  const keyConcepts = Array.isArray(req.body?.keyConcepts)
    ? req.body.keyConcepts.map((c) => String(c)).filter((c) => c.trim()).slice(0, 6)
    : [];

  if (!topic || !explanation) {
    return res.status(400).json({ error: 'Topic and explanation are required.' });
  }

  const userPrompt = `A student is learning "${topic}" at ${level} level. The lesson covered these key concepts:
${keyConcepts.map((c) => `- ${c}`).join('\n') || '(none listed)'}

The student was asked to teach the topic back in their own words, as if to someone who has never learned it. Here is what they wrote:
"""
${explanation}
"""

Analyze their CONCEPTUAL UNDERSTANDING only. Do NOT judge writing style, grammar, spelling or vocabulary unless the error makes the explanation scientifically wrong.
Focus on: what they got right, what is partially right, what is wrong or backwards (misconceptions), and which key concepts are missing.
Be encouraging and constructive.

Return JSON with EXACTLY this shape:
{
  "correctly_understood": array of 2-5 short strings (ideas they clearly got right),
  "partially_understood": array of 0-3 short strings (right direction, incomplete),
  "misconceptions": array of 0-3 short strings (things they got wrong or backwards),
  "missing_concepts": array of 0-3 short strings (key concepts they did not mention),
  "overall_understanding": integer 0-100 (their conceptual understanding),
  "biggest_learning_gap": string (the single most important misconception or missing concept, in simple words),
  "targeted_explanation": string (3-5 sentences re-teaching exactly that gap, using a vivid approach for a ${level} learner),
  "follow_up_questions": array of 1-3 objects: {
    "question": string,
    "options": array of exactly 4 strings,
    "correctAnswer": integer index 0-3,
    "concept": string (the weak concept),
    "explanation": string (why the correct answer is right)
  }
}
The follow-up questions must test the exact misconception or missing concept — not general knowledge.`;

  try {
    const text = await callLLM(SYSTEM_PROMPT, userPrompt);
    const raw = extractJson(text);
    res.json(validateTeachBack(raw, topic, level, []));
  } catch (err) {
    console.error('[teachback] AI call failed, using demo fallback:', err.message);
    res.json(getDemoTeachBack(topic, explanation, keyConcepts));
  }
});

router.post('/review', async (req, res) => {
  const topic = str(req.body?.topic);
  const level = LEVELS.includes(req.body?.level) ? req.body.level : 'Beginner';
  const concepts = Array.isArray(req.body?.concepts)
    ? req.body.concepts.map((c) => String(c)).filter((c) => c.trim()).slice(0, 4)
    : [];

  if (!topic || concepts.length === 0) {
    return res.status(400).json({ error: 'Topic and at least one concept are required.' });
  }

  const userPrompt = `A student is revising "${topic}" at ${level} level. Earlier assessment showed these concepts are the weakest:
${concepts.map((c) => `- ${c}`).join('\n')}

Create a SHORT focused review pack: 3 multiple-choice questions that target ONLY those weak concepts (about one each), from fresh angles. Match ${level} level. Be encouraging.

Return JSON with EXACTLY this shape:
{
  "topic": "${topic}",
  "focusConcepts": [the weak concept strings],
  "intro": string (1-2 sentences: what this review covers and why),
  "questions": array of 3 objects: {
    "question": string,
    "options": array of exactly 4 strings,
    "correctAnswer": integer index 0-3,
    "concept": one of the weak concept strings,
    "explanation": string (why the correct answer is right)
  }
}`;

  try {
    const text = await callLLM(SYSTEM_PROMPT, userPrompt);
    const raw = extractJson(text);
    res.json(validateReviewPack(raw, topic, concepts));
  } catch (err) {
    console.error('[review] AI call failed, using demo fallback:', err.message);
    res.json(getDemoReview(topic, concepts));
  }
});

export default router;
