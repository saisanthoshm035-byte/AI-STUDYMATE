import { describe, it, expect } from 'vitest';
import {
  computeGaps,
  computeReadiness,
  evaluateAnswerLocally,
  localSkillExtraction,
  mapCompetencies,
  nextDifficulty,
} from '../src/rpl/analysis';
import type { CompetencyMapping, ExtractedSkill, RplAnswer, RplQuestion } from '../src/rpl/types';

const COMPETENCIES = ['Electrical Safety', 'Wiring', 'Circuit Installation', 'Fault Diagnosis', 'Maintenance', 'Load Calculation'];

const q = (over: Partial<RplQuestion>): RplQuestion => ({
  id: 'q1',
  type: 'Scenario',
  competency: 'Wiring',
  difficulty: 'Intermediate',
  prompt: 'Test question?',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 0,
  guidance: 'safe systematic approach',
  ...over,
});

describe('RPL local skill extraction', () => {
  it('detects fully described competencies as high confidence', () => {
    const skills = localSkillExtraction(
      { text: 'I do wiring and circuit installation in houses', jobs: '', training: '', tools: '' },
      COMPETENCIES,
    );
    const wiring = skills.find((s) => s.name === 'Wiring');
    expect(wiring).toBeDefined();
    expect(wiring!.confidence).toBe('High confidence');
  });

  it('does not invent skills that were never mentioned', () => {
    const skills = localSkillExtraction(
      { text: 'I stitch blouses and saree falls', jobs: '', training: '', tools: '' },
      COMPETENCIES,
    );
    expect(skills.find((s) => s.name === 'Electrical Safety')).toBeUndefined();
  });

  it('marks partial matches as medium confidence', () => {
    const skills = localSkillExtraction(
      { text: 'I repair wiring faults in old buildings', jobs: '', training: '', tools: '' },
      COMPETENCIES,
    );
    const wiring = skills.find((s) => s.name === 'Wiring');
    expect(wiring).toBeDefined();
    expect(['Medium confidence', 'High confidence']).toContain(wiring!.confidence);
  });
});

describe('RPL competency mapping', () => {
  it('maps high-confidence skills to Demonstrated', () => {
    const skills: ExtractedSkill[] = [
      { name: 'Wiring', category: 'Technical skill', confidence: 'High confidence', source: 'Work experience' },
      { name: 'Maintenance', category: 'Technical skill', confidence: 'Medium confidence', source: 'Self-reported' },
    ];
    const mappings = mapCompetencies(skills, COMPETENCIES);
    expect(mappings.find((m) => m.competency === 'Wiring')!.status).toBe('Demonstrated');
    expect(mappings.find((m) => m.competency === 'Maintenance')!.status).toBe('Partially Demonstrated');
    expect(mappings.find((m) => m.competency === 'Load Calculation')!.status).toBe('Not Yet Demonstrated');
  });

  it('fuzzy-matches AI skill names to framework competencies', () => {
    const skills: ExtractedSkill[] = [
      { name: 'Domestic wiring installation', category: 'Process', confidence: 'High confidence', source: 'Experience + evidence' },
      { name: 'Electrical fault troubleshooting', category: 'Process', confidence: 'High confidence', source: 'Experience' },
      { name: 'Use of multimeter', category: 'Tool', confidence: 'Needs evidence', source: 'Mentioned only' },
      { name: 'Power tools handling', category: 'Tool', confidence: 'Needs evidence', source: 'Mentioned only' },
    ];
    const mappings = mapCompetencies(skills, ['Wiring', 'Fault Diagnosis', 'Tools & Instruments', 'Load Calculation']);
    expect(mappings.find((m) => m.competency === 'Wiring')!.status).toBe('Demonstrated');
    expect(mappings.find((m) => m.competency === 'Fault Diagnosis')!.status).toBe('Demonstrated');
    // "Power tools handling" shares the word "tools" but carries no evidence → Evidence Required
    expect(mappings.find((m) => m.competency === 'Tools & Instruments')!.status).toBe('Evidence Required');
    // No skill shares any word with "Load Calculation" → Not Yet Demonstrated
    expect(mappings.find((m) => m.competency === 'Load Calculation')!.status).toBe('Not Yet Demonstrated');
  });
});

describe('RPL gap analysis', () => {
  it('moves a competency to needs-more-evidence when assessment confirms it', () => {
    const mappings: CompetencyMapping[] = [
      { competency: 'Fault Diagnosis', evidence: 'Experience', status: 'Partially Demonstrated' },
    ];
    const questions = [q({ id: 'q1', competency: 'Fault Diagnosis', correctAnswer: 0 })];
    const answers: Record<string, RplAnswer> = {
      q1: { chosen: 0, evaluation: { competency: 'Fault Diagnosis', knowledgeEvidence: 100, practicalReasoning: 100, safetyAwareness: 100, feedback: '', autoScored: true, correct: true } },
    };
    const gaps = computeGaps(mappings, answers, questions);
    expect(gaps.needsMoreEvidence).toContain('Fault Diagnosis');
    expect(gaps.learningGaps).not.toContain('Fault Diagnosis');
  });

  it('keeps unconfirmed partial competencies out of demonstrated', () => {
    const mappings: CompetencyMapping[] = [
      { competency: 'Fault Diagnosis', evidence: 'Experience', status: 'Partially Demonstrated' },
    ];
    const gaps = computeGaps(mappings, {}, []);
    expect(gaps.demonstrated).not.toContain('Fault Diagnosis');
    expect(gaps.needsMoreEvidence).toContain('Fault Diagnosis');
  });

  it('flags wrong MCQ answers as learning gaps', () => {
    const mappings: CompetencyMapping[] = [
      { competency: 'Electrical Safety', evidence: 'Experience', status: 'Demonstrated' },
    ];
    const questions = [q({ id: 'q1', competency: 'Electrical Safety', correctAnswer: 0 })];
    const answers: Record<string, RplAnswer> = {
      q1: { chosen: 2, evaluation: { competency: 'Electrical Safety', knowledgeEvidence: 0, practicalReasoning: 0, safetyAwareness: 0, feedback: '', autoScored: true, correct: false } },
    };
    const gaps = computeGaps(mappings, answers, questions);
    expect(gaps.learningGaps).toContain('Electrical Safety');
  });
});

describe('RPL readiness scoring', () => {
  it('produces a bounded overall score from all four components', () => {
    const readiness = computeReadiness({
      experience: {
        text: 'Five years of domestic wiring, repairs, fault finding and maintenance across many houses. I also trained two apprentices.'.repeat(2),
        jobs: 'Helper 2 years, own contractor 3 years',
        training: 'Safety workshop',
        tools: 'Multimeter, tester, stripper',
      },
      evidence: [
        { id: '1', name: 'Letter', kind: 'Experience Letter', date: '2025-01-01', relatedSkill: '', status: 'Uploaded' },
        { id: '2', name: 'Photo', kind: 'Image', date: '2025-01-01', relatedSkill: '', status: 'Uploaded' },
      ],
      mappings: [
        { competency: 'A', evidence: 'x', status: 'Demonstrated' },
        { competency: 'B', evidence: 'x', status: 'Demonstrated' },
        { competency: 'C', evidence: 'x', status: 'Partially Demonstrated' },
        { competency: 'D', evidence: 'x', status: 'Not Yet Demonstrated' },
      ],
      questions: [q({ id: 'q1', correctAnswer: 0 })],
      answers: { q1: { chosen: 0, evaluation: { competency: 'A', knowledgeEvidence: 100, practicalReasoning: 100, safetyAwareness: 100, feedback: '', autoScored: true, correct: true } } },
    });
    for (const v of Object.values(readiness)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(readiness.overall).toBeGreaterThan(0);
  });

  it('returns zero-ish for an empty assessment without crashing', () => {
    const readiness = computeReadiness({
      experience: { text: '', jobs: '', training: '', tools: '' },
      evidence: [],
      mappings: [],
      questions: [],
      answers: {},
    });
    expect(readiness.overall).toBe(0);
  });
});

describe('adaptive difficulty sequencer', () => {
  it('steps up after a good result and down after a poor one', () => {
    expect(nextDifficulty('Beginner', 'good')).toBe('Intermediate');
    expect(nextDifficulty('Intermediate', 'good')).toBe('Advanced');
    expect(nextDifficulty('Advanced', 'poor')).toBe('Intermediate');
    expect(nextDifficulty('Intermediate', 'poor')).toBe('Beginner');
    expect(nextDifficulty('Advanced', 'good')).toBe('Advanced');
  });
});

describe('local answer evaluation fallback', () => {
  it('rewards answers that cover the guidance points', () => {
    const question = q({ guidance: 'safe isolation supply check multimeter' });
    const good = evaluateAnswerLocally(question, 'First I turn off the supply and isolate the circuit, then I check it is dead with a multimeter before touching anything. Safety comes first.');
    const weak = evaluateAnswerLocally(question, 'I just look at it.');
    expect(good.knowledgeEvidence).toBeGreaterThan(weak.knowledgeEvidence);
    expect(good.safetyAwareness).toBeGreaterThan(35);
  });

  it('never returns out-of-range scores', () => {
    const e = evaluateAnswerLocally(q({}), '');
    for (const v of [e.knowledgeEvidence, e.practicalReasoning, e.safetyAwareness]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
