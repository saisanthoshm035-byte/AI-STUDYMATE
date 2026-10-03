import { describe, it, expect } from 'vitest';
import { RPL_ROLES, getRole } from '../src/rpl/roles';
import { RPL_FALLBACK_QUESTIONS } from '../src/rpl/fallbackQuestions';

describe('RPL role frameworks', () => {
  it('includes every occupation from the spec', () => {
    const names = RPL_ROLES.map((r) => r.name);
    for (const expected of [
      'Electrician', 'Welder', 'Fitter', 'Plumber', 'Carpenter', 'Tailor', 'Beautician',
      'Automotive Technician', 'Construction Worker', 'Machine Operator', 'Data Entry Operator',
      'Graphic Designer', 'Web Developer', 'Digital Marketing Executive', 'Healthcare Assistant',
      'Retail Associate', 'Hospitality Worker', 'Agriculture Worker',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('gives every role at least 5 competencies', () => {
    for (const r of RPL_ROLES) {
      expect(r.competencies.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('electrician framework matches the spec example', () => {
    const electrician = getRole('Electrician')!;
    expect(electrician.competencies).toEqual([
      'Electrical Safety', 'Wiring', 'Circuit Installation', 'Equipment Handling',
      'Fault Diagnosis', 'Maintenance', 'Tools & Instruments',
    ]);
  });

  it('resolves roles by id or name', () => {
    expect(getRole('electrician')?.name).toBe('Electrician');
    expect(getRole('Welder')?.id).toBe('welder');
    expect(getRole('astronaut')).toBeNull();
  });
});

describe('RPL built-in fallback questions', () => {
  it('provides 5 questions covering scenario, situational and experience-based types', () => {
    expect(RPL_FALLBACK_QUESTIONS.length).toBe(5);
    const types = RPL_FALLBACK_QUESTIONS.map((q) => q.type);
    expect(types).toContain('Experience-based');
    expect(types.filter((t) => t === 'Scenario').length).toBeGreaterThanOrEqual(1);
    expect(types).toContain('Situational');
    // The open experience-based question has no options; the rest have exactly 4.
    for (const q of RPL_FALLBACK_QUESTIONS) {
      if (q.type === 'Experience-based') {
        expect(q.options.length).toBe(0);
        expect(q.correctAnswer).toBe(-1);
      } else {
        expect(q.options.length).toBe(4);
        expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(q.correctAnswer).toBeLessThan(4);
      }
    }
  });
});
