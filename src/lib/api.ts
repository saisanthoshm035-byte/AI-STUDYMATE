import type { AdaptiveExplanation, AiStatus, Lesson, QuizQuestion, ReviewPack, TeachBackAnalysis } from '../types';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  status(): Promise<AiStatus> {
    return fetch('/api/status', { signal: AbortSignal.timeout(8000) }).then((r) => r.json());
  },

  generateLesson(input: { topic: string; level: string; goal: string; time: string }): Promise<Lesson> {
    return post<Lesson>('/api/lesson', input);
  },

  adapt(input: {
    topic: string;
    level: string;
    concept: string;
    question: string;
    correctAnswer: string;
    chosen: string;
  }): Promise<AdaptiveExplanation> {
    return post<AdaptiveExplanation>('/api/adapt', input);
  },

  retryQuestion(input: { topic: string; level: string; concept: string; previousQuestion: string }): Promise<QuizQuestion> {
    return post<QuizQuestion>('/api/retry', input);
  },

  // ------------------------------------------------------------------
  // Intelligence layer (additive features). If these fail, the existing
  // app continues working — callers handle errors / fall back gracefully.
  // ------------------------------------------------------------------

  analyzeTeachBack(input: {
    topic: string;
    level: string;
    explanation: string;
    keyConcepts: string[];
  }): Promise<TeachBackAnalysis> {
    return post<TeachBackAnalysis>('/api/teachback', input);
  },

  reviewPack(input: { topic: string; level: string; concepts: string[] }): Promise<ReviewPack> {
    return post<ReviewPack>('/api/review', input);
  },
};
