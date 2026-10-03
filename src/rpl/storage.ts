import type { RplAssessment, RplEvidenceItem } from './types';
import { RPL_DEMO_EVIDENCE, RPL_DEMO_EXPERIENCE, RPL_DEMO_PROFILE } from './demo';

const KEY = 'studymate.rpl.assessments.v1';
const ACTIVE_KEY = 'studymate.rpl.active.v1';
const MAX_ASSESSMENTS = 30;

export function makeId(prefix = 'r'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadAssessments(): RplAssessment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RplAssessment[]) : [];
  } catch {
    return [];
  }
}

export function saveAssessment(a: RplAssessment): void {
  try {
    const all = loadAssessments();
    const idx = all.findIndex((x) => x.id === a.id);
    const stamped = { ...a, updatedAt: Date.now() };
    if (idx >= 0) all[idx] = stamped;
    else all.unshift(stamped);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX_ASSESSMENTS)));
  } catch {
    /* storage unavailable — app still works */
  }
}

export function getAssessment(id: string): RplAssessment | null {
  return loadAssessments().find((a) => a.id === id) ?? null;
}

export function deleteAssessment(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadAssessments().filter((a) => a.id !== id)));
  } catch {
    /* ignore */
  }
}

/** Draft wizard state survives a page refresh mid-assessment. */
export function saveActiveDraft(a: RplAssessment): void {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

export function loadActiveDraft(): RplAssessment | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as RplAssessment) : null;
  } catch {
    return null;
  }
}

export function clearActiveDraft(): void {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function newAssessment(demo = false): RplAssessment {
  return {
    id: makeId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'draft',
    demo,
    profile: demo ? { ...RPL_DEMO_PROFILE } : { fullName: '', age: '', location: '', education: '', occupation: '', yearsExperience: '', employmentType: '', language: 'English' },
    roleId: '',
    roleName: '',
    competencies: [],
    experience: { text: '', jobs: '', training: '', tools: '' },
    evidence: [],
    skills: [],
    mappings: [],
    questions: [],
    answers: {},
    gaps: null,
    readiness: null,
    report: null,
    assessorReview: null,
  };
}

/** Demo assessment: pre-filled Arun Kumar data, marked DEMO everywhere. */
export function newDemoAssessment(): RplAssessment {
  const a = newAssessment(true);
  a.roleId = 'electrician';
  a.roleName = 'Electrician';
  a.competencies = ['Electrical Safety', 'Wiring', 'Circuit Installation', 'Equipment Handling', 'Fault Diagnosis', 'Maintenance', 'Tools & Instruments'];
  a.experience.text = RPL_DEMO_EXPERIENCE;
  a.evidence = RPL_DEMO_EVIDENCE.map((e) => ({ ...e, id: makeId('ev') })) as unknown as RplEvidenceItem[];
  return a;
}

/** Aggregate platform stats for the admin view (computed on-device). */
export function platformStats(): {
  totalCandidates: number;
  started: number;
  completed: number;
  topRoles: { name: string; count: number }[];
  commonGaps: { name: string; count: number }[];
  evidenceCount: number;
  needsHumanReview: number;
} {
  const all = loadAssessments();
  const roleCounts = new Map<string, number>();
  const gapCounts = new Map<string, number>();
  let evidenceCount = 0;
  let needsHumanReview = 0;
  let completed = 0;
  for (const a of all) {
    if (a.roleName) roleCounts.set(a.roleName, (roleCounts.get(a.roleName) ?? 0) + 1);
    evidenceCount += a.evidence.length;
    if (a.evidence.some((e) => e.status === 'Requires Human Verification') || a.mappings.some((m) => m.status === 'Evidence Required')) needsHumanReview++;
    if (a.status === 'complete') completed++;
    for (const g of a.gaps?.learningGaps ?? []) gapCounts.set(g, (gapCounts.get(g) ?? 0) + 1);
    for (const g of a.gaps?.needsMoreEvidence ?? []) gapCounts.set(g, (gapCounts.get(g) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return {
    totalCandidates: new Set(all.map((a) => a.profile.fullName.trim().toLowerCase() || a.id)).size,
    started: all.length,
    completed,
    topRoles: top(roleCounts, 5),
    commonGaps: top(gapCounts, 5),
    evidenceCount,
    needsHumanReview,
  };
}

/** Assessor console listing: assessments with AI flags needing human review. */
export function assessmentsForReview(): RplAssessment[] {
  return loadAssessments().filter(
    (a) =>
      a.status !== 'draft' &&
      (a.mappings.some((m) => m.status === 'Evidence Required' || m.status === 'Not Yet Demonstrated') ||
        a.evidence.some((e) => e.status === 'Requires Human Verification')),
  );
}

export function latestAssessment(): RplAssessment | null {
  return loadAssessments()[0] ?? null;
}
