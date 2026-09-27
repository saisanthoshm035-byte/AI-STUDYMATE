/**
 * Client-side demo fallback.
 *
 * Used only if the API is unreachable (e.g., the backend crashed mid-demo).
 * Mirrors the server-side demo engine so the adaptive loop keeps working
 * even in the worst case — the app should never hit an error screen live.
 */
import demoJson from '../../demo/demoContent.json';
import type { AdaptiveExplanation, Lesson, QuizQuestion, ReviewPack, TeachBackAnalysis } from '../types';

interface DemoAdaptive {
  concept: string;
  approach: string;
  explanation: string;
  keyIdea: string;
}

interface DemoLesson {
  topic: string;
  summary: string;
  keyConcepts: { title: string; explanation: string }[];
  realWorldExample: string;
  analogy: string;
  commonMistakes: string[];
  quiz: QuizQuestion[];
  adaptive: DemoAdaptive[];
  retryQuestions: QuizQuestion[];
}

const DEMO = demoJson as { lessons: DemoLesson[] };

function norm(t: string): string {
  return (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function findLesson(topic: string): DemoLesson {
  const t = norm(topic);
  return (
    DEMO.lessons.find((l) => norm(l.topic) === t) ||
    DEMO.lessons.find((l) => t.includes(norm(l.topic)) || norm(l.topic).includes(t)) ||
    DEMO.lessons[0]
  );
}

export function demoLesson(topic: string, level: string, goal: string, time: string): Lesson {
  const base = findLesson(topic);
  const summary =
    level === 'Advanced'
      ? `${base.summary} At an advanced level, focus on the quantitative relationships and edge cases behind each idea.`
      : level === 'Intermediate'
        ? `${base.summary} At this level, connect each idea to how it is used in practice.`
        : base.summary;
  return {
    topic: topic.trim() || base.topic,
    level: (['Beginner', 'Intermediate', 'Advanced'].includes(level) ? level : 'Beginner') as Lesson['level'],
    goal,
    timeMinutes: time || null,
    summary,
    keyConcepts: base.keyConcepts,
    realWorldExample: base.realWorldExample,
    analogy: base.analogy,
    commonMistakes: base.commonMistakes,
    quiz: base.quiz.map((q) => ({ ...q, options: [...q.options] })),
    source: 'demo',
    model: 'Demo Engine',
  };
}

export function demoAdapt(concept: string, topic: string): AdaptiveExplanation {
  const base = findLesson(topic);
  const hit = base.adaptive.find((a) => norm(a.concept) === norm(concept));
  return hit ?? base.adaptive[0];
}

export function demoRetry(concept: string, topic: string): QuizQuestion {
  const base = findLesson(topic);
  const pool = base.retryQuestions;
  const q = pool.find((x) => norm(x.concept) === norm(concept)) ?? pool[0];
  const copy = { ...q, options: [...q.options] };
  const correct = copy.options[copy.correctAnswer];
  for (let i = copy.options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy.options[i], copy.options[j]] = [copy.options[j], copy.options[i]];
  }
  return { ...copy, correctAnswer: copy.options.indexOf(correct) };
}

/** Demo teach-back analysis: keyword heuristic over the built-in lesson. */
export function demoTeachBack(topic: string, explanation: string): TeachBackAnalysis {
  const base = findLesson(topic);
  const text = norm(explanation);
  const hit = (c: string) => {
    const words = norm(c).split(' ').filter((w) => w.length > 3);
    return words.some((w) => text.includes(w));
  };

  const correctly_understood: string[] = [];
  const missing_concepts: string[] = [];
  for (const c of base.keyConcepts) {
    if (hit(c.title)) correctly_understood.push(c.title);
    else missing_concepts.push(c.title);
  }

  const misconceptions: string[] = [];
  if (/plants? (eat|drink|take) (food|soil)/.test(text)) misconceptions.push('Plants do not "eat" soil — their mass comes from carbon dioxide in the air.');
  if (/oxygen is (the|an) (input|ingredient)/.test(text)) misconceptions.push('Oxygen is an output of photosynthesis, not an input.');
  if (/calvin.{0,40}(needs? (light|sunlight))/.test(text) && !/not need light directly/.test(text)) misconceptions.push('The Calvin Cycle does not use light directly — it runs on ATP and NADPH.');

  const biggest = misconceptions[0] || missing_concepts[0] || 'the exact role of each input and output';
  const overall = Math.max(10, Math.min(95, 35 + correctly_understood.length * 15 - misconceptions.length * 10));
  const gapAdaptive = base.adaptive.find((a) => norm(a.concept) === norm(biggest)) || base.adaptive[0];

  return {
    correctly_understood,
    partially_understood: [],
    misconceptions,
    missing_concepts,
    overall_understanding: overall,
    biggest_learning_gap: biggest,
    targeted_explanation: gapAdaptive
      ? `${gapAdaptive.explanation} Key idea: ${gapAdaptive.keyIdea}`
      : `Review the lesson's key concepts on ${base.topic}, then try explaining it again — you're close.`,
    follow_up_questions: base.retryQuestions.slice(0, 2).map((q) => ({ ...q, options: [...q.options] })),
  };
}

/** Demo review pack: reuses built-in retry questions for the weak concepts. */
export function demoReview(topic: string, concepts: string[]): ReviewPack {
  const base = findLesson(topic);
  const wanted = concepts.map((c) => norm(c));
  let questions = base.retryQuestions.filter((q) => wanted.includes(norm(q.concept)));
  if (questions.length === 0) questions = base.retryQuestions.slice(0, 3);
  questions = questions.slice(0, 3).map((q) => ({ ...q, options: [...q.options] }));
  return {
    topic: base.topic,
    focusConcepts: concepts,
    intro: `A quick refresher on ${concepts.join(', ')} — the concepts your results suggest reviewing first.`,
    questions,
  };
}
