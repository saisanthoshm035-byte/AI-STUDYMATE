export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Goal = 'Understand the basics' | 'Prepare for an exam' | 'Revise quickly' | 'Master the concept';

export interface Concept {
  title: string;
  explanation: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  concept: string;
  explanation: string;
}

export interface Lesson {
  topic: string;
  level: Level;
  goal?: string;
  timeMinutes?: string | null;
  summary: string;
  keyConcepts: Concept[];
  realWorldExample: string;
  analogy: string;
  commonMistakes: string[];
  quiz: QuizQuestion[];
  source: 'ai' | 'demo';
  model: string;
}

export interface AdaptiveExplanation {
  concept: string;
  approach: string;
  explanation: string;
  keyIdea: string;
}

export interface LearningSession {
  id: string;
  topic: string;
  level: Level;
  initialScore: number; // percent 0-100
  retryScore: number | null; // percent 0-100
  totalQuestions: number;
  weakConcepts: string[];
  masteredConcepts: string[];
  improvedConcepts: string[];
  durationMinutes: number;
  createdAt: number;
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
  label: string;
  demo: boolean;
}

export interface Attempt {
  question: QuizQuestion;
  chosen: number;
  correct: boolean;
  /** Optional confidence signal (intelligence layer) — quiz works without it. */
  confidence?: ConfidenceLevel | null;
}

export interface WeakConceptInfo {
  concept: string;
  question: QuizQuestion;
  chosen: number;
}

export type Screen =
  | 'landing'
  | 'setup'
  | 'generating'
  | 'lesson'
  | 'quiz'
  | 'analysis'
  | 'adaptive'
  | 'retry'
  | 'summary'
  | 'progress'
  | 'error'
  | 'teachback'
  | 'retention'
  | 'review'
  // RPL skill assessment layer (additive — existing screens untouched)
  | 'rpl'
  | 'assessor'
  // SKILLFORGE AI — job simulation layer (additive — existing screens untouched)
  | 'forge';

// ---------------------------------------------------------------------------
// Intelligence layer (additive): confidence, teach-back, retention
// ---------------------------------------------------------------------------

/** Optional per-question confidence signal — the quiz works fine without it. */
export type ConfidenceLevel = 'guessing' | 'somewhat' | 'very';

export type ConfidenceState = 'strong' | 'underconfident' | 'gap' | 'misconception';

export interface ConfidenceSummary {
  strong: number;
  underconfident: number;
  gaps: number;
  misconceptions: number;
  insight: string;
  flaggedConcepts: string[]; // concepts in the misconception (confidence-gap) state
}

export interface TeachBackAnalysis {
  correctly_understood: string[];
  partially_understood: string[];
  misconceptions: string[];
  missing_concepts: string[];
  overall_understanding: number; // 0-100
  biggest_learning_gap: string;
  targeted_explanation: string;
  follow_up_questions: QuizQuestion[];
}

export interface RetentionPoint {
  label: string;
  days: number;
  percent: number;
  tone: 'good' | 'warn' | 'bad';
}

export interface ConceptRetention {
  concept: string;
  estimated_retention: number; // % expected tomorrow
  review_priority: 'strong' | 'needs review' | 'high';
  recommended_review_time: string;
  reason: string;
}

export interface RetentionReport {
  topic: string;
  todayPercent: number;
  curve: RetentionPoint[];
  concepts: ConceptRetention[];
  recommendedReview: ConceptRetention | null;
  recommendationText: string;
}

/** A short focused review pack (~3 questions on weak concepts). */
export interface ReviewPack {
  topic: string;
  focusConcepts: string[];
  questions: QuizQuestion[];
  intro: string;
}
