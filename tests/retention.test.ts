import { describe, it, expect } from 'vitest';
import {
  collectConceptSignals,
  conceptRetentionCurve,
  buildRetentionReport,
  toneFor,
} from '../src/lib/retention';
import type { Attempt, QuizQuestion, TeachBackAnalysis } from '../src/types';

function q(concept: string): QuizQuestion {
  return {
    question: `Question about ${concept}?`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    concept,
    explanation: 'Because it is so.',
  };
}

function attempt(concept: string, correct: boolean, confidence: Attempt['confidence']): Attempt {
  return { question: q(concept), chosen: correct ? 0 : 1, correct, confidence };
}

function teachBack(partial: Partial<TeachBackAnalysis> = {}): TeachBackAnalysis {
  return {
    correctly_understood: [],
    partially_understood: [],
    misconceptions: [],
    missing_concepts: [],
    overall_understanding: 70,
    biggest_learning_gap: '',
    targeted_explanation: 'x',
    follow_up_questions: [],
    ...partial,
  };
}

describe('collectConceptSignals', () => {
  it('aggregates attempts per concept', () => {
    const map = collectConceptSignals([
      attempt('Light energy', true, 'very'),
      attempt('Light energy', true, 'somewhat'),
      attempt('Chlorophyll', false, 'guessing'),
    ]);
    expect(map.get('Light energy')).toMatchObject({ correct: 2, total: 2, misconceptions: 0 });
    expect(map.get('Chlorophyll')).toMatchObject({ correct: 0, total: 1, misconceptions: 0 });
  });

  it('marks incorrect + high confidence as a misconception signal', () => {
    const map = collectConceptSignals([attempt('Glucose production', false, 'very')]);
    expect(map.get('Glucose production')).toMatchObject({ misconceptions: 1, correct: 0, total: 1 });
  });

  it('gives a correctly taught-back concept a bonus datapoint', () => {
    const map = collectConceptSignals([attempt('Light energy', true, 'guessing')], teachBack({
      correctly_understood: ['Light energy'],
    }));
    expect(map.get('Light energy')).toMatchObject({ total: 2, correct: 2, taughtBack: true });
  });

  it('flags a concept similar to the biggest learning gap as a misconception', () => {
    const map = collectConceptSignals([attempt('Glucose production', true, 'very')], teachBack({
      biggest_learning_gap: 'Glucose production',
    }));
    expect(map.get('Glucose production')).toMatchObject({ misconceptions: 1 });
  });

  it('records quick-review outcomes without changing correctness counts', () => {
    const map = collectConceptSignals([attempt('Light energy', true, 'very')], null, [
      attempt('Light energy', true, 'guessing'),
      attempt('Chlorophyll', false, 'guessing'),
    ]);
    const le = map.get('Light energy')!;
    expect(le.reviewTotal).toBe(1);
    expect(le.reviewHits).toBe(1);
    expect(le.correct).toBe(1); // review attempts do not inflate quiz accuracy
    expect(map.get('Chlorophyll')!.reviewTotal).toBe(1);
  });

  it('returns an empty map for no attempts', () => {
    expect(collectConceptSignals([], null, []).size).toBe(0);
  });
});

describe('conceptRetentionCurve', () => {
  it('decays strongly with misconceptions and slowly with strong understanding', () => {
    const strong = conceptRetentionCurve({
      correct: 2, total: 2, highConfidenceCorrect: 2, misconceptions: 0,
      taughtBack: false, teachBackHit: false, reviewHits: 0, reviewTotal: 0,
    });
    const misconception = conceptRetentionCurve({
      correct: 0, total: 1, highConfidenceCorrect: 0, misconceptions: 1,
      taughtBack: false, teachBackHit: false, reviewHits: 0, reviewTotal: 0,
    });
    expect(strong.today).toBeGreaterThan(misconception.today);
    expect(strong.perDay).toBeGreaterThan(misconception.perDay);
  });

  it('rewards successful review rounds with slower decay', () => {
    const noReview = conceptRetentionCurve({
      correct: 1, total: 1, highConfidenceCorrect: 1, misconceptions: 0,
      taughtBack: false, teachBackHit: false, reviewHits: 0, reviewTotal: 0,
    });
    const reviewed = conceptRetentionCurve({
      correct: 1, total: 1, highConfidenceCorrect: 1, misconceptions: 0,
      taughtBack: false, teachBackHit: false, reviewHits: 2, reviewTotal: 2,
    });
    expect(reviewed.perDay).toBeGreaterThan(noReview.perDay);
  });
});

describe('buildRetentionReport', () => {
  it('produces a 0/1/3/7-day curve with non-increasing percentages', () => {
    const report = buildRetentionReport(
      'Photosynthesis',
      [attempt('Light energy', true, 'very'), attempt('Chlorophyll', false, 'guessing')],
      null,
    );
    expect(report.curve.map((p) => p.days)).toEqual([0, 1, 3, 7]);
    const pcts = report.curve.map((p) => p.percent);
    expect(pcts[0]).toBeGreaterThanOrEqual(pcts[1]);
    expect(pcts[1]).toBeGreaterThanOrEqual(pcts[2]);
    expect(pcts[2]).toBeGreaterThanOrEqual(pcts[3]);
    expect(report.todayPercent).toBe(pcts[0]);
  });

  it('varies with performance — a perfect session retains more than a failing one', () => {
    const good = buildRetentionReport('T', [attempt('C1', true, 'very'), attempt('C2', true, 'very')], null);
    const bad = buildRetentionReport('T', [attempt('C1', false, 'very'), attempt('C2', false, 'very')], null);
    expect(good.todayPercent).toBeGreaterThan(bad.todayPercent);
    expect(good.curve[3].percent).toBeGreaterThan(bad.curve[3].percent);
  });

  it('boosts today estimate when the teach-back went well', () => {
    const without = buildRetentionReport('T', [attempt('C1', true, 'very')], null);
    const withTb = buildRetentionReport('T', [attempt('C1', true, 'very')], teachBack({ overall_understanding: 85 }));
    expect(withTb.todayPercent).toBeGreaterThan(without.todayPercent);
  });

  it('ranks misconception concepts as high priority and recommends them first', () => {
    const report = buildRetentionReport('T', [attempt('Glucose production', false, 'very')], null);
    const top = report.concepts[0];
    expect(top.review_priority).toBe('high');
    expect(top.recommended_review_time).toBe('tomorrow');
    expect(report.recommendedReview?.concept).toBe('Glucose production');
    expect(report.recommendationText).toContain('Glucose production');
  });

  it('marks fully mastered concepts as strong', () => {
    const report = buildRetentionReport('T', [attempt('Light energy', true, 'very')], null);
    const le = report.concepts.find((c) => c.concept === 'Light energy')!;
    expect(le.review_priority).toBe('strong');
    expect(le.recommended_review_time).toBe('in 7 days');
  });

  it('recovers a concept after a successful quick review', () => {
    // Half-learned concept: without review it drops below the 'high' threshold overnight;
    // a successful review slows the decay enough to move it back to 'needs review'.
    const base = [attempt('Gap concept', false, 'guessing'), attempt('Gap concept', true, 'guessing')];
    const before = buildRetentionReport('T', base, null);
    const after = buildRetentionReport('T', base, null, [attempt('Gap concept', true, 'guessing')]);
    const b = before.concepts.find((c) => c.concept === 'Gap concept')!;
    const a = after.concepts.find((c) => c.concept === 'Gap concept')!;
    expect(a.estimated_retention).toBeGreaterThan(b.estimated_retention);
    expect(b.review_priority).toBe('high');
    expect(a.review_priority).toBe('needs review');
  });

  it('handles no attempts gracefully', () => {
    const report = buildRetentionReport('T', [], null);
    expect(report.concepts).toEqual([]);
    expect(report.recommendedReview).toBeNull();
    expect(report.curve.length).toBe(4);
  });
});

describe('toneFor', () => {
  it('maps percentages to tones', () => {
    expect(toneFor(90)).toBe('good');
    expect(toneFor(70)).toBe('warn');
    expect(toneFor(40)).toBe('bad');
  });
});
