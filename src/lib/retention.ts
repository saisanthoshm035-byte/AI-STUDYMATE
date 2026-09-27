import type {
  Attempt,
  ConceptRetention,
  ConfidenceLevel,
  RetentionPoint,
  RetentionReport,
  TeachBackAnalysis,
} from '../types';

/**
 * Knowledge Retention / Decay Predictor (additive, frontend-only heuristic).
 *
 * A prototype estimator — NOT a scientific memory model. It blends simple,
 * explainable signals: quiz correctness, stated confidence, misconception
 * flags (incorrect + high confidence) and teach-back performance.
 */

export interface ConceptSignals {
  correct: number;
  total: number;
  highConfidenceCorrect: number;
  misconceptions: number; // incorrect + high confidence
  taughtBack: boolean;
  teachBackHit: boolean;
  reviewHits: number;
  reviewTotal: number;
}

const DAY_DECAY = {
  strong: 0.9, // per-day multiplier when understanding is solid
  medium: 0.82,
  weak: 0.7,
};

function defaultSignals(): ConceptSignals {
  return {
    correct: 0,
    total: 0,
    highConfidenceCorrect: 0,
    misconceptions: 0,
    taughtBack: false,
    teachBackHit: false,
    reviewHits: 0,
    reviewTotal: 0,
  };
}

function isHigh(c: ConfidenceLevel | null | undefined): boolean {
  return c === 'somewhat' || c === 'very';
}

function norm(t: string): string {
  return (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function similar(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

/** Build per-concept signals from attempts (+ optional teach-back / review results). */
export function collectConceptSignals(
  attempts: Attempt[] = [],
  teachBack: TeachBackAnalysis | null = null,
  reviewAttempts: Attempt[] = [],
): Map<string, ConceptSignals> {
  const map = new Map<string, ConceptSignals>();

  for (const a of attempts) {
    const concept = a.question.concept;
    if (!map.has(concept)) map.set(concept, defaultSignals());
    const s = map.get(concept)!;
    s.total += 1;
    if (a.correct) {
      s.correct += 1;
      if (isHigh(a.confidence)) s.highConfidenceCorrect += 1;
    } else if (isHigh(a.confidence)) {
      s.misconceptions += 1;
    }
  }

  if (teachBack) {
    const good = teachBack.correctly_understood ?? [];
    const bad = [...(teachBack.misconceptions ?? []), ...(teachBack.missing_concepts ?? [])];
    for (const [concept, s] of map) {
      const taughtOk = good.some((g) => similar(g, concept));
      const taughtBad = bad.some((b) => similar(b, concept));
      if (taughtOk && !taughtBad) {
        // Explaining it correctly is a strong memory signal — add a bonus datapoint.
        s.taughtBack = true;
        s.teachBackHit = true;
        s.correct += 1;
        s.total += 1;
        s.highConfidenceCorrect += 1;
      }
      if (taughtBad) {
        s.taughtBack = false;
        s.teachBackHit = false;
      }
    }
    const gap = (teachBack.biggest_learning_gap || '').trim();
    if (gap) {
      const target = [...map.keys()].find((c) => similar(c, gap));
      if (target) map.get(target)!.misconceptions += 1;
    }
  }

  // Quick Review results reinforce memory (additive signal — never resets progress).
  for (const r of reviewAttempts) {
    const concept = r.question.concept;
    if (!map.has(concept)) map.set(concept, defaultSignals());
    const s = map.get(concept)!;
    s.reviewTotal += 1;
    if (r.correct) s.reviewHits += 1;
  }

  return map;
}

// === report builder below ===

/** Deterministic, explainable decay math for one concept. */
export function conceptRetentionCurve(s: ConceptSignals): { today: number; perDay: number } {
  const total = Math.max(1, s.total);
  const accuracy = s.correct / total;
  const today = clampRound(46 + 46 * accuracy + (s.taughtBack ? 6 : 0));
  let tier: keyof typeof DAY_DECAY = 'weak';
  if (accuracy >= 0.99 && (s.highConfidenceCorrect > 0 || s.taughtBack)) tier = 'strong';
  else if (accuracy >= 0.5) tier = 'medium';
  let perDay = DAY_DECAY[tier];

  // Misconceptions decay much faster than plain knowledge gaps.
  if (s.misconceptions > 0) perDay = Math.min(perDay, 0.74);
  // Later review rounds that went well reinforce memory.
  if (s.reviewTotal > 0) {
    const reviewRate = s.reviewHits / s.reviewTotal;
    perDay = Math.min(0.97, perDay + 0.09 * reviewRate);
  }
  return { today, perDay };
}

function clampRound(v: number): number {
  return Math.max(5, Math.min(98, Math.round(v)));
}

export function toneFor(percent: number): RetentionPoint['tone'] {
  if (percent >= 80) return 'good';
  if (percent >= 60) return 'warn';
  return 'bad';
}

/** Build the full retention report for a topic. */
export function buildRetentionReport(
  topic: string,
  attempts: Attempt[],
  teachBack: TeachBackAnalysis | null,
  reviewAttempts: Attempt[] = [],
): RetentionReport {
  const signals = collectConceptSignals(attempts, teachBack, reviewAttempts);
  const concepts: ConceptRetention[] = [];

  for (const [concept, s] of signals) {
    const { today, perDay } = conceptRetentionCurve(s);
    const tomorrow = clampRound(today * perDay);
    let priority: ConceptRetention['review_priority'] = 'needs review';
    let time = 'in 3 days';
    if (tomorrow >= 80 && s.misconceptions === 0) {
      priority = 'strong';
      time = 'in 7 days';
    } else if (tomorrow < 62 || s.misconceptions > 0) {
      priority = 'high';
      time = s.misconceptions > 0 ? 'tomorrow' : 'in 1–2 days';
    }
    concepts.push({
      concept,
      estimated_retention: tomorrow,
      review_priority: priority,
      recommended_review_time: time,
      reason: reasonFor(s, priority),
    });
  }

  const sorted = [...concepts].sort((a, b) => a.estimated_retention - b.estimated_retention);
  const weakest = sorted[0] ?? null;

  const topicSignals: ConceptSignals = {
    correct: attempts.filter((a) => a.correct).length,
    total: Math.max(1, attempts.length),
    highConfidenceCorrect: attempts.filter((a) => a.correct && isHigh(a.confidence)).length,
    misconceptions: attempts.filter((a) => !a.correct && isHigh(a.confidence)).length,
    taughtBack: !!teachBack && teachBack.overall_understanding >= 60,
    teachBackHit: false,
    reviewHits: reviewAttempts.filter((r) => r.correct).length,
    reviewTotal: reviewAttempts.length,
  };
  const { today: topicToday, perDay: topicDecay } = conceptRetentionCurve(topicSignals);

  const curve: RetentionPoint[] = [0, 1, 3, 7].map((d) => {
    const pct = clampRound(topicToday * Math.pow(topicDecay, d));
    return {
      label: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`,
      days: d,
      percent: pct,
      tone: toneFor(pct),
    };
  });

  const recommendationText = weakest
    ? `We recommend reviewing “${weakest.concept}” ${weakest.recommended_review_time} because ${weakest.reason}.`
    : 'Complete a quiz to get personalized retention estimates.';

  return {
    topic,
    todayPercent: curve[0].percent,
    curve,
    concepts: sorted,
    recommendedReview: weakest,
    recommendationText,
  };
}

function reasonFor(s: ConceptSignals, priority: ConceptRetention['review_priority']): string {
  if (s.misconceptions > 0) return 'it was misunderstood despite high confidence (a confidence gap)';
  if (s.reviewTotal > 0 && s.reviewHits === s.reviewTotal) return 'the re-test showed you re-mastered it';
  if (priority === 'high') return 'it was answered incorrectly and not yet re-verified';
  if (priority === 'needs review') return 'part of it is still shaky';
  return 'it was answered correctly with good confidence';
}
