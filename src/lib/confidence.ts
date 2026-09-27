import type { Attempt, ConfidenceLevel, ConfidenceState, ConfidenceSummary } from '../types';

/**
 * Confidence Gap Detection (additive, frontend-only).
 *
 * Classifies each attempt by comparing the student's stated confidence with
 * the actual correctness of their answer. The quiz flow is unchanged —
 * confidence is purely optional metadata that rides along on each attempt.
 */

export const CONFIDENCE_OPTIONS: { value: ConfidenceLevel; emoji: string; label: string }[] = [
  { value: 'guessing', emoji: '😰', label: 'Guessing' },
  { value: 'somewhat', emoji: '🤔', label: 'Somewhat sure' },
  { value: 'very', emoji: '😎', label: 'Very confident' },
];

const HIGH_CONFIDENCE: ConfidenceLevel[] = ['somewhat', 'very'];

/** High confidence = "somewhat sure" or "very confident". */
export function isHighConfidence(c: ConfidenceLevel | null | undefined): boolean {
  return !!c && HIGH_CONFIDENCE.includes(c);
}

/** Classify one attempt into one of the four confidence × correctness states. */
export function classifyConfidence(correct: boolean, confidence: ConfidenceLevel | null): ConfidenceState {
  const high = isHighConfidence(confidence);
  if (correct && high) return 'strong';
  if (correct && !high) return 'underconfident';
  if (!correct && high) return 'misconception';
  return 'gap';
}

const STATE_LABELS: Record<ConfidenceState, string> = {
  strong: 'Strong understanding',
  underconfident: 'Under-confident',
  gap: 'Knowledge gap',
  misconception: 'Potential misconception',
};

export function confidenceStateLabel(s: ConfidenceState): string {
  return STATE_LABELS[s];
}

/** Aggregate attempts into the Confidence vs Knowledge summary. */
export function buildConfidenceSummary(attempts: Attempt[]): ConfidenceSummary {
  let strong = 0;
  let underconfident = 0;
  let gaps = 0;
  let misconceptions = 0;
  const flagged: string[] = [];

  for (const a of attempts) {
    const state = classifyConfidence(a.correct, a.confidence ?? null);
    if (state === 'strong') strong += 1;
    else if (state === 'underconfident') underconfident += 1;
    else if (state === 'gap') gaps += 1;
    else {
      misconceptions += 1;
      uniquePush(flagged, a.question.concept);
    }
  }

  return {
    strong,
    underconfident,
    gaps,
    misconceptions,
    insight: insightText(strong, underconfident, gaps, misconceptions, flagged),
    flaggedConcepts: flagged,
  };
}

function insightText(strong: number, underconfident: number, gaps: number, misconceptions: number, flagged: string[]): string {
  if (misconceptions > 0) {
    const what = flagged.length === 1 ? `“${flagged[0]}”` : `${flagged.length} concepts`;
    return `You understood most of the topic, but you were highly confident on ${what} you answered incorrectly. We recommend reviewing ${flagged.length === 1 ? 'it' : 'them'} before moving on.`;
  }
  if (gaps > 0 && strong > 0) {
    return `You understood most of the topic. The questions you missed were ones you flagged as unsure — normal knowledge gaps, and exactly what the adaptive re-teaching is for.`;
  }
  if (underconfident >= 2) {
    return `You got answers right while doubting yourself — your knowledge is ahead of your confidence. Trust what you've learned; you know more than you think.`;
  }
  if (strong >= 3) {
    return `Your confidence matches your results — you know exactly what you know. Well-calibrated learner!`;
  }
  return 'Answer a few questions with confidence ratings to see how well your confidence matches your knowledge.';
}

// Local helper kept tiny to avoid changing shared utilities.
function uniquePush(arr: string[], value: string) {
  if (!arr.includes(value)) arr.push(value);
}
