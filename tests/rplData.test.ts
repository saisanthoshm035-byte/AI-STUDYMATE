import { describe, it, expect } from 'vitest';
import { RPL_ROLES, getRole } from '../src/rpl/roles';
import { RPL_DEMO_QUESTIONS, RPL_DEMO_PROFILE, RPL_DEMO_EXPERIENCE, RPL_DEMO_EVIDENCE } from '../src/rpl/demo';

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

describe('RPL demo data (spec section 18)', () => {
  it('is the mandated sample candidate', () => {
    expect(RPL_DEMO_PROFILE.fullName).toBe('Arun Kumar');
    expect(RPL_DEMO_PROFILE.occupation).toBe('Electrician');
    expect(RPL_DEMO_PROFILE.yearsExperience).toBe('5');
  });

  it('covers the mandated demo skills', () => {
    const text = RPL_DEMO_EXPERIENCE.toLowerCase();
    for (const s of ['wiring', 'maintenance', 'fault', 'safety']) {
      expect(text).toContain(s);
    }
  });

  it('has sample evidence of mixed types', () => {
    const kinds = RPL_DEMO_EVIDENCE.map((e) => e.kind);
    expect(kinds).toContain('Experience Letter');
    expect(kinds).toContain('Image');
    expect(kinds).toContain('Certificate');
  });

  it('demo questions are 5 and include experience-based + scenario types', () => {
    expect(RPL_DEMO_QUESTIONS.length).toBe(5);
    const types = RPL_DEMO_QUESTIONS.map((q) => q.type);
    expect(types).toContain('Experience-based');
    expect(types.filter((t) => t === 'Scenario').length).toBeGreaterThanOrEqual(1);
    expect(types).toContain('Situational');
    // Exactly one experience-based (open) question; others have 4 options.
    for (const q of RPL_DEMO_QUESTIONS) {
      if (q.type === 'Experience-based') {
        expect(q.options.length).toBe(0);
      } else {
        expect(q.options.length).toBe(4);
      }
    }
  });
});
