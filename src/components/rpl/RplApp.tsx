import { useCallback, useEffect, useRef, useState } from 'react';
import RplDashboard from './RplDashboard';
import RplWizard from './RplWizard';
import SkillAnalysis from './SkillAnalysis';
import RplQuestionCard from './RplQuestionCard';
import RplResults from './RplResults';
import AssessorConsole from './AssessorConsole';
import type { AnswerEvaluation, RplAssessment, RplQuestion } from '../../rpl/types';
import { rplApi } from '../../rpl/api';
import {
  clearActiveDraft,
  deleteAssessment as deleteAssessmentInStore,
  getAssessment,
  loadActiveDraft,
  makeId,
  newAssessment,
  saveActiveDraft,
  saveAssessment,
} from '../../rpl/storage';
import {
  computeGaps,
  computeReadiness,
  evaluateAnswerLocally,
  localSkillExtraction,
  localCompetencyQuestions,
  mapCompetencies,
} from '../../rpl/analysis';
import {
  QUESTIONS_PER_COMPETENCY,
  toCombinedResults,
  runQuestions,
  competencyPlan,
  allCompetenciesAssessed,
} from '../../rpl/skills-review';

type Phase = 'dashboard' | 'wizard' | 'analysis' | 'questions' | 'results' | 'assessor';

const OBJ_TYPES = new Set(['MCQ', 'Scenario', 'Situational', 'Technical']);

function isObjective(q: RplQuestion): boolean {
  return OBJ_TYPES.has(q.type) && (q.options?.length ?? 0) === 4 && (q.correctAnswer ?? -1) >= 0;
}

/**
 * A page refresh during question loading can leave a run's loading flag stuck
 * in storage — clear it so the run shows as in-progress (resumable), not frozen.
 */
function normalizeRuns(a: RplAssessment): RplAssessment {
  const runs = a.competencyRuns ?? {};
  const changed = Object.values(runs).some((r) => r.questionsLoading);
  if (!changed) return a;
  const cleaned: RplAssessment['competencyRuns'] = {};
  for (const [k, r] of Object.entries(runs)) cleaned[k] = { ...r, questionsLoading: false };
  return { ...a, competencyRuns: cleaned };
}

export default function RplApp({ startInAssessor = false }: { onHome: () => void; startInAssessor?: boolean }) {
  const [phase, setPhase] = useState<Phase>(startInAssessor ? 'assessor' : 'dashboard');
  const [assessment, setAssessment] = useState<RplAssessment | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<'ai' | 'local' | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [currentEval, setCurrentEval] = useState<AnswerEvaluation | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Per-competency mini-assessment state.
  const [activeCompetency, setActiveCompetency] = useState<string | null>(null);
  const [compQIndex, setCompQIndex] = useState(0);
  // Question-batch loading: while true the UI shows a skeleton, never an error.
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const qReqId = useRef(0);

  // Resume an interrupted draft (page refresh mid-assessment).
  useEffect(() => {
    const draft = loadActiveDraft();
    if (draft && draft.status === 'draft') {
      const clean = normalizeRuns(draft);
      setAssessment(clean);
      if (clean !== draft) saveAssessment(clean);
      setPhase('wizard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((a: RplAssessment) => {
    setAssessment(a);
    saveAssessment(a);
    if (a.status === 'draft') saveActiveDraft(a);
    else clearActiveDraft();
  }, []);

  const startNew = useCallback(
    () => {
      const a = newAssessment();
      persist(a);
      setCurrentEval(null);
      setActiveCompetency(null);
      setPhase('wizard');
    },
    [persist],
  );

  const openAssessment = useCallback(
    (id: string) => {
      const stored = getAssessment(id);
      if (!stored) return;
      const a = normalizeRuns(stored);
      setAssessment(a);
      setCurrentEval(null);
      setActiveCompetency(null);
      // Route to the right place based on how far it got.
      if (a.status === 'draft') setPhase('wizard');
      else if (a.report || a.readiness || a.combined) setPhase('results');
      else if (a.skills.length > 0) {
        // Resume an in-progress competency run at its first unanswered question.
        const inProg = Object.values(a.competencyRuns ?? {}).find(
          (r) => r.status === 'in-progress' && r.questionIds.length > 0 && r.questionIds.some((qid) => !a.answers[qid]),
        );
        if (inProg) {
          const idx = inProg.questionIds.findIndex((qid) => !a.answers[qid]);
          setActiveCompetency(inProg.competency);
          setCompQIndex(idx >= 0 ? idx : 0);
          setPhase('questions');
        } else {
          setPhase('analysis');
        }
      } else setPhase('wizard');
    },
    [],
  );

  const exitToDashboard = useCallback(() => {
    if (assessment && assessment.status === 'draft') saveActiveDraft(assessment);
    setActiveCompetency(null);
    setPhase('dashboard');
  }, [assessment]);

  // ------------------------------------------------------------ AI analysis

  const runAnalysis = useCallback(
    async (a: RplAssessment) => {
      setPhase('analysis');
      setAnalyzing(true);
      setAnalysisSource(null);
      let skills = a.skills;
      let source: 'ai' | 'local' = 'local';
      try {
        const res = await rplApi.extractSkills({
          role: a.roleName,
          competencies: a.competencies,
          experience: a.experience,
          evidenceNames: a.evidence.map((e) => `${e.name} (${e.kind})`),
        });
        skills = res.skills;
        source = (res as { source?: 'ai' | 'local' }).source === 'ai' ? 'ai' : 'local';
      } catch {
        skills = localSkillExtraction(a.experience, a.competencies);
        source = 'local';
      }
      const next: RplAssessment = {
        ...a,
        skills,
        mappings: mapCompetencies(skills, a.competencies),
        competencyRuns: {},
        combined: null,
        report: null,
        status: 'analyzed',
      };
      persist(next);
      setAnalysisSource(source);
      setAnalyzing(false);
    },
    [persist],
  );

  // ------------------------------------------------------ per-competency quiz

  const patchCompetencyRun = useCallback(
    (a: RplAssessment, competency: string, patch: Partial<RplAssessment['competencyRuns'][string]>) => {
      const runs = { ...a.competencyRuns };
      const prev = runs[competency] ?? {
        competency,
        status: 'in-progress' as const,
        questionsLoading: false,
        questionIds: [],
        loadError: null,
        startedAt: Date.now(),
        completedAt: null,
      };
      runs[competency] = { ...prev, ...patch };
      return { ...a, competencyRuns: runs };
    },
    [],
  );

  /** Load one competency's own mini question batch (AI with built-in fallback). */
  const startCompetency = useCallback(
    async (a: RplAssessment, competency: string) => {
      const reqId = ++qReqId.current;
      setActiveCompetency(competency);
      setQuestionsLoading(true);
      setPhase('questions');
      setCompQIndex(0);
      setCurrentEval(null);

      let withRun = patchCompetencyRun(a, competency, {
        status: 'in-progress',
        questionsLoading: true,
        loadError: null,
        startedAt: a.competencyRuns[competency]?.startedAt || Date.now(),
        completedAt: null,
      });
      setAssessment(withRun);

      let loaded: RplQuestion[] = [];
      try {
        const res = await rplApi.generateQuestions({
          role: a.roleName,
          competencies: [competency],
          weakCompetencies: [],
          experienceText: [a.experience.text, a.experience.jobs, a.experience.training].filter(Boolean).join('\n'),
          language: a.profile.language,
          count: QUESTIONS_PER_COMPETENCY,
        });
        loaded = res.questions.map((q) => ({ ...q, id: q.id || makeId('q') }));
      } catch {
        // The server usually still answers (built-in engine). A thrown error is
        // a transport problem — retry once, then use the local generator.
        try {
          await new Promise((r) => setTimeout(r, 1500));
          if (reqId !== qReqId.current) return;
          const res = await rplApi.generateQuestions({
            role: a.roleName,
            competencies: [competency],
            weakCompetencies: [],
            experienceText: [a.experience.text, a.experience.jobs, a.experience.training].filter(Boolean).join('\n'),
            language: a.profile.language,
            count: QUESTIONS_PER_COMPETENCY,
          });
          loaded = res.questions.map((q) => ({ ...q, id: q.id || makeId('q') }));
        } catch {
          // AI unreachable AND transport failed: the built-in generator keeps
          // the assessment alive — still no user-facing error.
          loaded = localCompetencyQuestions(a.roleName, competency, a.experience.text, QUESTIONS_PER_COMPETENCY);
        }
      }
      if (reqId !== qReqId.current) return; // a newer load superseded this one
      loaded = loaded.filter((q) => q.prompt);
      if (loaded.length === 0) {
        loaded = localCompetencyQuestions(a.roleName, competency, a.experience.text, QUESTIONS_PER_COMPETENCY);
      }
      // Unique ids across batches (servers number q1..qN per batch).
      const compSlug = competency.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      loaded = loaded.map((q, i) => ({ ...q, id: `q_${compSlug}_${i}_${reqId}`, competency }));

      withRun = patchCompetencyRun(withRun, competency, {
        status: 'in-progress',
        questionsLoading: false,
        questionIds: loaded.map((q) => q.id),
        loadError: null,
      });
      const next: RplAssessment = { ...withRun, questions: [...withRun.questions.filter((q) => !loaded.some((l) => l.id === q.id)), ...loaded] };
      setAssessment(next);
      saveAssessment(next);
      if (next.status === 'draft') saveActiveDraft(next);
      setQuestionsLoading(false);
    },
    [patchCompetencyRun],
  );

  const retryCompetencyLoad = useCallback(
    (competency: string) => {
      if (!assessment) return;
      void startCompetency(assessment, competency);
    },
    [assessment, startCompetency],
  );

  const submitAnswer = useCallback(
    async (payload: { text?: string; chosen?: number }) => {
      if (!assessment || !activeCompetency) return;
      const run = assessment.competencyRuns[activeCompetency];
      const questions = (run?.questionIds ?? [])
        .map((id) => assessment.questions.find((q) => q.id === id))
        .filter((q): q is RplQuestion => Boolean(q));
      const q = questions[compQIndex];
      if (!q) return;
      setEvaluating(true);
      setCurrentEval(null);

      let evaluation: AnswerEvaluation;
      if (isObjective(q)) {
        const correct = payload.chosen === q.correctAnswer;
        evaluation = {
          competency: q.competency,
          knowledgeEvidence: correct ? 100 : 0,
          practicalReasoning: correct ? 100 : 0,
          safetyAwareness: correct ? 100 : 0,
          feedback: correct ? 'Correct.' : 'Review the framework area for this competency.',
          autoScored: true,
          correct,
        };
      } else {
        const text = payload.text ?? '';
        try {
          const res = await rplApi.evaluateAnswer({
            role: assessment.roleName,
            competency: q.competency,
            question: q.prompt,
            guidance: q.guidance,
            answer: text,
          });
          evaluation = res.evaluation;
        } catch {
          evaluation = evaluateAnswerLocally(q, text);
        }
      }

      const next: RplAssessment = {
        ...assessment,
        answers: { ...assessment.answers, [q.id]: payload.chosen !== undefined ? { chosen: payload.chosen, evaluation } : { text: payload.text, evaluation } },
      };
      setAssessment(next);
      saveAssessment(next);
      if (next.status === 'draft') saveActiveDraft(next);
      setCurrentEval(evaluation);
      setEvaluating(false);
    },
    [assessment, activeCompetency, compQIndex],
  );

  /** Leave a half-done competency run — it stays "in-progress" for later. */
  const pauseCompetency = useCallback(() => {
    setCurrentEval(null);
    setActiveCompetency(null);
    setPhase('analysis');
  }, []);

  const completeCompetency = useCallback(() => {
    if (!assessment || !activeCompetency) return;
    let done = patchCompetencyRun(assessment, activeCompetency, { status: 'assessed', completedAt: Date.now() });
    // Once every competency is assessed, aggregate gaps + readiness across all
    // batches so the results screen shows them immediately.
    if (allCompetenciesAssessed(done)) {
      const allQs = competencyPlan(done).flatMap((c) => runQuestions(done, c));
      done = {
        ...done,
        gaps: computeGaps(done.mappings, done.answers, allQs),
        readiness: computeReadiness({ ...done, questions: allQs }),
        status: 'assessed',
      };
    }
    saveAssessment(done);
    setAssessment(done);
    if (done.status === 'draft') saveActiveDraft(done);
    else clearActiveDraft();
    setCurrentEval(null);
    setActiveCompetency(null);
    setPhase('analysis');
  }, [assessment, activeCompetency, patchCompetencyRun]);

  const nextCompQuestion = useCallback(() => {
    if (!assessment || !activeCompetency) return;
    const run = assessment.competencyRuns[activeCompetency];
    const total = run?.questionIds.length ?? 0;
    setCurrentEval(null);
    if (compQIndex + 1 >= total) {
      completeCompetency();
    } else {
      setCompQIndex((i) => i + 1);
    }
  }, [assessment, activeCompetency, compQIndex, completeCompetency]);

  // --------------------------------------------------- combined final report

  const generateReport = useCallback(async () => {
    if (!assessment) return;
    setReportLoading(true);
    let working = assessment;
    try {
      // 1. Cross-competency analysis over the per-competency results.
      if (!working.combined) {
        try {
          const res = await rplApi.combinedAnalysis({
            role: working.roleName,
            competencyResults: toCombinedResults(working).competencyResults.map((r) => ({
              competency: r.competency,
              scorePercent: r.scorePercent,
              answeredCount: r.answeredCount,
              totalQuestions: r.totalQuestions,
            })),
            mappings: working.mappings,
          });
          working = {
            ...working,
            combined: {
              summary: res.summary,
              strengths: res.strengths ?? [],
              improvements: res.improvements ?? [],
              source: (res as { source?: 'ai' | 'local' }).source === 'local' ? 'local' : 'ai',
              model: (res as { model?: string }).model ?? 'AI',
            },
          };
        } catch {
          const rows = toCombinedResults(working).competencyResults;
          const avg = Math.round(rows.reduce((s, r) => s + r.scorePercent, 0) / (rows.length || 1));
          working = {
            ...working,
            combined: {
              summary: `All ${rows.length} competency assessments are complete, with a combined preliminary indicator of ${avg}%. An authorized RPL assessor makes the final decision — use this as preparation.`,
              strengths: rows.filter((r) => r.scorePercent >= 60).map((r) => r.competency).slice(0, 4),
              improvements: rows.filter((r) => r.scorePercent < 60).map((r) => r.competency).slice(0, 4),
              source: 'local',
              model: 'Built-in assessment engine',
            },
          };
        }
      }
      // 2. Aggregate gaps + readiness across ALL competency batches.
      const allQs = competencyPlan(working).flatMap((c) => runQuestions(working, c));
      const gaps = computeGaps(working.mappings, working.answers, allQs);
      const readiness = computeReadiness({ ...working, questions: allQs });
      const answered = Object.values(working.answers).filter((a) => a.text || a.chosen !== undefined).length;
      // 3. The full report, fed with the combined picture.
      let report = working.report;
      try {
        const res = await rplApi.report({
          profile: working.profile as unknown as Record<string, string>,
          role: working.roleName,
          competencies: working.competencies,
          mappings: working.mappings,
          skills: working.skills,
          gaps,
          readiness: readiness as unknown as Record<string, number>,
          assessmentSummary: { answered, total: allQs.length },
          evidence: working.evidence.map((e) => ({ name: e.name, kind: e.kind, status: e.status })),
        });
        report = res.report;
      } catch {
        report = null; // the results screen still shows the local analysis
      }
      const done: RplAssessment = { ...working, gaps, readiness, report, status: 'complete' };
      saveAssessment(done);
      setAssessment(done);
    } catch {
      setAssessment((prev) => (prev ? { ...prev, status: 'complete' } : prev));
    } finally {
      setReportLoading(false);
    }
  }, [assessment]);

  // ---------------------------------------------------------------- render

  if (phase === 'assessor') {
    return <AssessorConsole onExit={() => setPhase('dashboard')} />;
  }

  if (phase === 'dashboard') {
    return (
      <RplDashboard
        onStartNew={startNew}
        onOpenAssessment={openAssessment}
        onDeleteAssessment={deleteAssessmentInStore}
        onOpenAssessor={() => setPhase('assessor')}
      />
    );
  }

  if (!assessment) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-ink-soft">No assessment open. </p>
        <button onClick={() => setPhase('dashboard')} className="btn btn-primary btn-lg mt-4">Back to RPL Dashboard</button>
      </div>
    );
  }

  if (phase === 'wizard') {
    return (
      <RplWizard
        assessment={assessment}
        onChange={(a) => persist(a)}
        onAnalyze={() => void runAnalysis(assessment)}
        onExit={exitToDashboard}
      />
    );
  }

  if (phase === 'analysis') {
    return (
      <SkillAnalysis
        assessment={assessment}
        analyzing={analyzing}
        source={analysisSource}
        onRegenerate={() => void runAnalysis(assessment)}
        onStartCompetency={(competency) => void startCompetency(assessment, competency)}
        onResumeCompetency={(competency) => {
          const run = assessment.competencyRuns[competency];
          const questions = (run?.questionIds ?? [])
            .map((id) => assessment.questions.find((q) => q.id === id))
            .filter((q): q is RplQuestion => Boolean(q));
          const idx = questions.findIndex((q) => !assessment.answers[q.id]);
          setActiveCompetency(competency);
          setCompQIndex(idx >= 0 ? idx : 0);
          setCurrentEval(null);
          setQuestionsLoading(false);
          setPhase('questions');
        }}
        onRetakeCompetency={(competency) => void startCompetency(assessment, competency)}
        onResults={() => setPhase('results')}
      />
    );
  }

  if (phase === 'questions') {
    const run = activeCompetency ? assessment.competencyRuns[activeCompetency] : undefined;
    const questions = (run?.questionIds ?? [])
      .map((id) => assessment.questions.find((q) => q.id === id))
      .filter((q): q is RplQuestion => Boolean(q));

    // Loading: keep the user here with a skeleton — never an error while loading.
    if (questionsLoading || run?.questionsLoading) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 animate-pulse" />
          </div>
          <section className="card mt-3 p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-600">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Preparing your {activeCompetency ? `${activeCompetency} assessment` : 'assessment'}…
            </div>
            <div className="mt-5 space-y-3" role="presentation">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
              <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-6 space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl border border-line bg-slate-50" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          </section>
        </div>
      );
    }

    // Genuine failure only: batch marked failed and nothing usable to show.
    if (run?.status === 'failed' && questions.length === 0) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="mt-4 text-ink-soft">Questions could not be loaded. Please try again.</p>
          <button onClick={() => retryCompetencyLoad(run.competency)} className="btn btn-primary btn-lg mt-4">Retry</button>
          <button onClick={pauseCompetency} className="btn btn-ghost btn-lg mt-4 sm:ml-3">Back to skills</button>
        </div>
      );
    }

    const q = questions[compQIndex];
    if (!q) {
      // Batch missing locally (e.g. storage cleared) — reload it quietly.
      return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="mt-4 text-ink-soft">Preparing your assessment…</p>
          <button onClick={() => activeCompetency && void startCompetency(assessment, activeCompetency)} className="btn btn-primary btn-lg mt-4">Reload questions</button>
        </div>
      );
    }

    return (
      <>
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={compQIndex} aria-valuemin={0} aria-valuemax={questions.length}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all" style={{ width: `${((compQIndex + (currentEval ? 1 : 0)) / questions.length) * 100}%` }} />
          </div>
        </div>
        <RplQuestionCard
          key={q.id}
          question={q}
          index={compQIndex}
          total={questions.length}
          evaluating={evaluating}
          evaluation={currentEval}
          onSubmit={(p) => void submitAnswer(p)}
          onNext={nextCompQuestion}
          onExit={pauseCompetency}
        />
      </>
    );
  }

  // results
  return (
    <RplResults
      assessment={assessment}
      reportLoading={reportLoading}
      onGenerateReport={() => void generateReport()}
      onRestart={() => startNew()}
      onDashboard={() => setPhase('dashboard')}
      onBackToSkills={() => setPhase('analysis')}
    />
  );
}
