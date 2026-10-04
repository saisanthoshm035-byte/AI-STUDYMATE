import { describe, it, expect } from 'vitest';
import {
  QUESTIONS_PER_COMPETENCY,
  competencyPlan,
  competencyRun,
  competencyRuns,
  assessedCount,
  allCompetenciesAssessed,
  pendingCompetencies,
  currentCompetency,
  firstUnansweredIndex,
  scoreCompetency,
  toCombinedResults,
  runQuestions,
} from '../src/rpl/skills-review';
import { localCompetencyQuestions } from '../src/rpl/analysis';
import { newAssessment } from '../src/rpl/storage';
import type { RplAssessment } from '../src/rpl/types';

function makeAssessment(): RplAssessment {
  const a = newAssessment();
  return {
    ...a,
    roleName: 'Electrician',
    competencies: ['Electrical Safety', 'Wiring', 'Circuit Installation'],
    skills: [
      { name: 'Electrical Safety', category: 'Knowledge area', confidence: 'High confidence', source: 'Work experience' },
      { name: 'Wiring', category: 'Technical skill', confidence: 'Medium confidence', source: 'Work experience' },
      { name: 'Circuit Installation', category: 'Process', confidence: 'High confidence', source: 'Work experience' },
    ],
    mappings: [
      { competency: 'Electrical Safety', evidence: 'Work experience', status: 'Demonstrated' },
      { competency: 'Wiring', evidence: 'Work experience', status: 'Partially Demonstrated' },
      { competency: 'Circuit Installation', evidence: 'Work experience', status: 'Demonstrated' },
    ],
    status: 'analyzed',
  };
}

describe('per-competency plan', () => {
  it('covers every framework competency (7 = 7 mini-assessments)', () => {
    const a = makeAssessment();
    expect(competencyPlan(a)).toEqual(['Electrical Safety', 'Wiring', 'Circuit Installation']);
  });

  it('dedupes duplicated competency entries', () => {
    const a = makeAssessment();
    a.competencies = [...a.competencies, 'Wiring'];
    expect(competencyPlan(a)).toEqual(['Electrical Safety', 'Wiring', 'Circuit Installation']);
  });
});

describe('run tracking', () => {
  it('treats a competency without a run as not-started', () => {
    const a = makeAssessment();
    const run = competencyRun(a, 'Wiring');
    expect(run.state).toBe('not-started');
    expect(run.scorePct).toBe(0);
  });

  it('marks a run assessed only when its status is assessed', () => {
    let a = makeAssessment();
    a = {
      ...a,
      competencyRuns: {
        Wiring: { competency: 'Wiring', status: 'assessed', questionsLoading: false, questionIds: ['q1', 'q2', 'q3'], loadError: null, startedAt: 1, completedAt: 2 },
      },
    };
    expect(competencyRun(a, 'Wiring').state).toBe('assessed');
    expect(pendingCompetencies(a)).toEqual(['Electrical Safety', 'Circuit Installation']);
    expect(assessedCount(a)).toBe(1);
    expect(allCompetenciesAssessed(a)).toBe(false);
  });

  it('hides behind a loading state while batch generation runs', () => {
    const a: RplAssessment = {
      ...makeAssessment(),
      competencyRuns: {
        Wiring: { competency: 'Wiring', status: 'in-progress', questionsLoading: true, questionIds: [], loadError: null, startedAt: 1, completedAt: null },
      },
    };
    expect(competencyRun(a, 'Wiring').state).toBe('loading');
  });

  it('resume priority: in-progress before not-started; none when all assessed', () => {
    let a = makeAssessment();
    a = {
      ...a,
      competencyRuns: {
        Wiring: { competency: 'Wiring', status: 'in-progress', questionsLoading: false, questionIds: ['q1'], loadError: null, startedAt: 1, completedAt: null },
      },
    };
    expect(currentCompetency(a)).toBe('Wiring');
    const done: RplAssessment = {
      ...a,
      competencyRuns: {
        'Electrical Safety': { competency: 'Electrical Safety', status: 'assessed', questionsLoading: false, questionIds: [], loadError: null, startedAt: 1, completedAt: 2 },
        Wiring: { competency: 'Wiring', status: 'assessed', questionsLoading: false, questionIds: [], loadError: null, startedAt: 1, completedAt: 2 },
        'Circuit Installation': { competency: 'Circuit Installation', status: 'assessed', questionsLoading: false, questionIds: [], loadError: null, startedAt: 1, completedAt: 2 },
      },
    };
    expect(currentCompetency(done)).toBeNull();
    expect(allCompetenciesAssessed(done)).toBe(true);
  });

  it('firstUnansweredIndex resumes mid-run and clamps when all answered', () => {
    const questions = localCompetencyQuestions('Electrician', 'Wiring', '', 3).map((q, i) => ({ ...q, id: `q${i + 1}` }));
    const answers = { q1: { chosen: 0 } } as RplAssessment['answers'];
    expect(firstUnansweredIndex(questions, answers)).toBe(1);
    expect(firstUnansweredIndex(questions, { q1: { chosen: 0 }, q2: { text: 'x' }, q3: { chosen: 2 } })).toBe(0);
  });
});

describe('scoring and combined results', () => {
  it('scores from evaluation knowledge evidence and counts answered', () => {
    const questions = localCompetencyQuestions('Electrician', 'Wiring', '', 3).map((q, i) => ({ ...q, id: `q${i + 1}` }));
    const answers = {
      q1: { chosen: 0, evaluation: { competency: 'Wiring', knowledgeEvidence: 100, practicalReasoning: 0, safetyAwareness: 0, feedback: '', autoScored: true, correct: true } },
      q2: { text: 'answer', evaluation: { competency: 'Wiring', knowledgeEvidence: 60, practicalReasoning: 0, safetyAwareness: 0, feedback: '' } },
    } as RplAssessment['answers'];
    const s = scoreCompetency(questions, answers);
    expect(s.answeredCount).toBe(2);
    expect(s.assessedCount).toBe(2);
    expect(s.scorePercent).toBe(80);
  });

  it('toCombinedResults lists every planned competency with its state', () => {
    let a = makeAssessment();
    a = {
      ...a,
      competencyRuns: {
        'Electrical Safety': { competency: 'Electrical Safety', status: 'assessed', questionsLoading: false, questionIds: [], loadError: null, startedAt: 1, completedAt: 2 },
      },
    };
    const combined = toCombinedResults(a);
    expect(combined.competencyResults.map((r) => r.competency)).toEqual(['Electrical Safety', 'Wiring', 'Circuit Installation']);
    expect(combined.competencyResults[0].state).toBe('assessed');
    expect(combined.competencyResults[1].state).toBe('not-started');
  });

  it('runQuestions returns batch questions in planned order', () => {
    const a: RplAssessment = {
      ...makeAssessment(),
      questions: [
        { id: 'q_wiring_1', type: 'MCQ', competency: 'Wiring', difficulty: 'Beginner', prompt: 'A', options: ['a', 'b', 'c', 'd'], correctAnswer: 0 },
        { id: 'q_safety_1', type: 'MCQ', competency: 'Electrical Safety', difficulty: 'Beginner', prompt: 'B', options: ['a', 'b', 'c', 'd'], correctAnswer: 0 },
      ],
      competencyRuns: {
        Wiring: { competency: 'Wiring', status: 'in-progress', questionsLoading: false, questionIds: ['q_wiring_1'], loadError: null, startedAt: 1, completedAt: null },
        'Electrical Safety': { competency: 'Electrical Safety', status: 'in-progress', questionsLoading: false, questionIds: ['q_safety_1'], loadError: null, startedAt: 1, completedAt: null },
      },
    };
    expect(runQuestions(a, 'Wiring').map((q) => q.id)).toEqual(['q_wiring_1']);
    expect(runQuestions(a, 'Electrical Safety').map((q) => q.id)).toEqual(['q_safety_1']);
  });
});

describe('built-in per-competency generator', () => {
  it('produces the planned count with valid MCQ batches', () => {
    const qs = localCompetencyQuestions('Electrician', 'Wiring', 'I worked on wiring', 3);
    expect(qs.length).toBe(3);
    for (const q of qs) {
      expect(q.competency).toBe('Wiring');
      if (q.options.length === 4) expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
      else expect(q.correctAnswer).toBe(-1);
    }
  });
});

describe('skills-review module sanity', () => {
  it('batch size stays small enough to stay self-paced', () => {
    expect(QUESTIONS_PER_COMPETENCY).toBeGreaterThanOrEqual(3);
    expect(QUESTIONS_PER_COMPETENCY).toBeLessThanOrEqual(5);
  });

  it('competencyRuns views align with the plan', () => {
    const a = makeAssessment();
    expect(competencyRuns(a).length).toBe(3);
    expect(competencyRuns(a).every((r) => r.competency.length > 0)).toBe(true);
  });
});
