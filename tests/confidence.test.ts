import { describe, it, expect } from 'vitest';
import {
  isHighConfidence,
  classifyConfidence,
  buildConfidenceSummary,
} from '../src/lib/confidence';
import type { Attempt, QuizQuestion } from '../src/types';

function q(concept: string, question = `Question about ${concept}?`): QuizQuestion {
  return {
    question,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    concept,
    explanation: 'Because it is so.',
  };
}

function attempt(concept: string, correct: boolean, confidence: Attempt['confidence']): Attempt {
  return { question: q(concept), chosen: correct ? 0 : 1, correct, confidence };
}

describe('isHighConfidence', () => {
  it('treats "somewhat" and "very" as high confidence', () => {
    expect(isHighConfidence('somewhat')).toBe(true);
    expect(isHighConfidence('very')).toBe(true);
  });

  it('treats "guessing" and missing confidence as low', () => {
    expect(isHighConfidence('guessing')).toBe(false);
    expect(isHighConfidence(null)).toBe(false);
    expect(isHighConfidence(undefined)).toBe(false);
  });
});

describe('classifyConfidence', () => {
  it('classifies the four states correctly', () => {
    expect(classifyConfidence(true, 'very')).toBe('strong');
    expect(classifyConfidence(true, 'guessing')).toBe('underconfident');
    expect(classifyConfidence(false, 'guessing')).toBe('gap');
    expect(classifyConfidence(false, 'very')).toBe('misconception');
  });

  it('treats a correct answer without confidence as underconfident, not strong', () => {
    expect(classifyConfidence(true, null)).toBe('underconfident');
  });

  it('treats a wrong answer without confidence as a normal knowledge gap', () => {
    expect(classifyConfidence(false, null)).toBe('gap');
  });
});

describe('buildConfidenceSummary', () => {
  it('counts each of the four states', () => {
    const cs = buildConfidenceSummary([
      attempt('A', true, 'very'),
      attempt('A', true, 'somewhat'),
      attempt('B', true, 'guessing'),
      attempt('C', false, 'guessing'),
      attempt('D', false, 'very'),
    ]);
    expect(cs.strong).toBe(2);
    expect(cs.underconfident).toBe(1);
    expect(cs.gaps).toBe(1);
    expect(cs.misconceptions).toBe(1);
    expect(cs.flaggedConcepts).toEqual(['D']);
  });

  it('flags no misconceptions when confidence is never high on wrong answers', () => {
    const cs = buildConfidenceSummary([
      attempt('A', false, 'guessing'),
      attempt('B', false, 'guessing'),
    ]);
    expect(cs.misconceptions).toBe(0);
    expect(cs.flaggedConcepts).toEqual([]);
  });

  it('deduplicates flagged concepts', () => {
    const cs = buildConfidenceSummary([
      attempt('X', false, 'very'),
      attempt('X', false, 'very'),
    ]);
    expect(cs.misconceptions).toBe(2);
    expect(cs.flaggedConcepts).toEqual(['X']);
  });

  it('produces an insight string mentioning review when misconceptions exist', () => {
    const cs = buildConfidenceSummary([attempt('Glucose production', false, 'very')]);
    expect(cs.insight).toMatch(/review/i);
  });

  it('handles an empty attempt list without throwing', () => {
    const cs = buildConfidenceSummary([]);
    expect(cs.strong + cs.underconfident + cs.gaps + cs.misconceptions).toBe(0);
    expect(typeof cs.insight).toBe('string');
  });
});
