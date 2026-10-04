import type {
  RplAssessment,
  RplQuestion,
} from './types';

/** Count of questions per competency assessment (kept small so it stays self-paced). */
export const QUESTIONS_PER_COMPETENCY = 3;

export type CompetencyState = 'not-started' | 'loading' | 'in-progress' | 'assessed' | 'failed';

/**
 * The per-competency plan: every framework competency gets its own mini MCQ
 * assessment, completed at the candidate's own pace (7 competencies = 7
 * short assessments, resumable at any time).
 */
export function competencyPlan(a: RplAssessment): string[] {
  return Array.from(new Set(a.competencies));
}

export interface CompetencyRunView {
  competency: string;
  state: CompetencyState;
  scorePct: number;
  answeredCount: number;
  totalQuestions: number;
  /** Present only while loading or on failure (retry affordance). */
  loadError: string | null;
}

/** Read-only view of one competency's run (safe on legacy assessments). */
export function competencyRun(a: RplAssessment, competency: string): CompetencyRunView {
  const run = a.competencyRuns?.[competency];
  const questions = runQuestions(a, competency);
  const score = scoreCompetency(questions, a.answers);
  const state: CompetencyState =
    run?.status === 'assessed'
      ? 'assessed'
      : run?.status === 'failed'
        ? 'failed'
        : run?.status === 'in-progress'
          ? 'in-progress'
          : 'not-started';
  return {
    competency,
    state: run?.questionsLoading && state !== 'assessed' ? 'loading' : state,
    scorePct: score.scorePercent,
    answeredCount: score.answeredCount,
    totalQuestions: run?.questionIds?.length || QUESTIONS_PER_COMPETENCY,
    loadError: run?.loadError ?? null,
  };
}

export function competencyRuns(a: RplAssessment): CompetencyRunView[] {
  return competencyPlan(a).map((c) => competencyRun(a, c));
}

export function assessedCount(a: RplAssessment): number {
  return competencyRuns(a).filter((r) => r.state === 'assessed').length;
}

/** Are ALL submitted competencies assessed? Only then can the final report be generated. */
export function allCompetenciesAssessed(a: RplAssessment): boolean {
  const comps = competencyPlan(a);
  return comps.length > 0 && comps.every((c) => competencyRun(a, c).state === 'assessed');
}

/** Competencies still awaiting the candidate, in framework order. */
export function pendingCompetencies(a: RplAssessment): string[] {
  return competencyRuns(a)
    .filter((r) => r.state !== 'assessed')
    .map((r) => r.competency);
}

/** First in-progress competency, so the candidate resumes where they left off. */
export function currentCompetency(a: RplAssessment): string | null {
  return competencyRuns(a).find((r) => r.state === 'in-progress')?.competency ?? null;
}

/** The questions of one competency's run, in planned order. */
export function runQuestions(a: RplAssessment, competency: string): RplQuestion[] {
  const ids = a.competencyRuns?.[competency]?.questionIds;
  if (!ids?.length) return [];
  const byId = new Map(a.questions.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is RplQuestion => Boolean(q));
}

/** First unanswered question inside a run — resume point after a refresh. */
export function firstUnansweredIndex(questions: RplQuestion[], answers: RplAssessment['answers']): number {
  const idx = questions.findIndex((q) => !answers[q.id]);
  return idx === -1 ? 0 : idx;
}

export function isOpenQuestion(q: RplQuestion): boolean {
  return !Array.isArray(q.options) || q.options.length !== 4 || q.correctAnswer < 0;
}

/**
 * Score one competency's answers on the 0-100 knowledge-evidence scale:
 * objective items carry their auto-score, open answers carry the AI indicator.
 */
export function scoreCompetency(
  questions: RplQuestion[],
  answers: RplAssessment['answers'],
): { scorePercent: number; assessedCount: number; answeredCount: number } {
  let sum = 0;
  let assessed = 0;
  let answered = 0;
  for (const q of questions) {
    const ans = answers[q.id];
    if (!ans) continue;
    answered += 1;
    if (ans.evaluation) {
      sum += ans.evaluation.knowledgeEvidence;
      assessed += 1;
    }
  }
  return {
    scorePercent: assessed > 0 ? Math.round(sum / assessed) : 0,
    assessedCount: assessed,
    answeredCount: answered,
  };
}

export interface CombinedCompetencyResult {
  competency: string;
  scorePercent: number;
  answeredCount: number;
  totalQuestions: number;
  state: CompetencyState;
}

export interface CombinedAssessmentResults {
  competencyResults: CombinedCompetencyResult[];
}

/** Per-competency result rows feeding the combined final analysis. */
export function toCombinedResults(a: RplAssessment): CombinedAssessmentResults {
  return {
    competencyResults: competencyPlan(a).map((c) => {
      const run = competencyRun(a, c);
      return {
        competency: c,
        scorePercent: run.scorePct,
        answeredCount: run.answeredCount,
        totalQuestions: run.totalQuestions,
        state: run.state,
      };
    }),
  };
}
