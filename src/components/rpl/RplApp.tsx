import { useCallback, useEffect, useState } from 'react';
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
  newAssessment,
  saveActiveDraft,
  saveAssessment,
} from '../../rpl/storage';
import {
  computeGaps,
  computeReadiness,
  evaluateAnswerLocally,
  localSkillExtraction,
  mapCompetencies,
} from '../../rpl/analysis';
import { makeId } from '../../rpl/storage';

type Phase = 'dashboard' | 'wizard' | 'analysis' | 'questions' | 'results' | 'assessor';

const OBJ_TYPES = new Set(['MCQ', 'Scenario', 'Situational', 'Technical']);

function isObjective(q: RplQuestion): boolean {
  return OBJ_TYPES.has(q.type) && (q.options?.length ?? 0) === 4 && (q.correctAnswer ?? -1) >= 0;
}

export default function RplApp({ startInAssessor = false }: { onHome: () => void; startInAssessor?: boolean }) {
  const [phase, setPhase] = useState<Phase>(startInAssessor ? 'assessor' : 'dashboard');
  const [assessment, setAssessment] = useState<RplAssessment | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<'ai' | 'local' | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [currentEval, setCurrentEval] = useState<AnswerEvaluation | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Resume an interrupted draft (page refresh mid-assessment).
  useEffect(() => {
    const draft = loadActiveDraft();
    if (draft && draft.status === 'draft') {
      setAssessment(draft);
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
      setPhase('wizard');
    },
    [persist],
  );

  const openAssessment = useCallback(
    (id: string) => {
      const a = getAssessment(id);
      if (!a) return;
      setAssessment(a);
      setCurrentEval(null);
      // Route to the right place based on how far it got.
      if (a.status === 'draft') setPhase('wizard');
      else if (a.report || a.readiness) setPhase('results');
      else if (a.questions.length > 0 && Object.keys(a.answers ?? {}).length > 0) {
        // Mid-quiz refresh: resume at the first unanswered question.
        const idx = a.questions.findIndex((q) => !a.answers[q.id]);
        setQIndex(idx >= 0 ? idx : 0);
        setPhase('questions');
      } else if (a.skills.length > 0) setPhase('analysis');
      else setPhase('wizard');
    },
    [],
  );

  const exitToDashboard = useCallback(() => {
    if (assessment && assessment.status === 'draft') saveActiveDraft(assessment);
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
        status: 'analyzed',
      };
      persist(next);
      setAnalysisSource(source);
      setAnalyzing(false);
    },
    [persist],
  );

  // ------------------------------------------------------ adaptive questions

  const [qIndex, setQIndex] = useState(0);

  const startQuestions = useCallback(
    async (a: RplAssessment) => {
      setPhase('questions');
      if (a.questions.length === 0) {
        // The server always answers with a valid set (AI or built-in engine).
        try {
          const weak = a.mappings.filter((m) => m.status !== 'Demonstrated').map((m) => m.competency);
          const res = await rplApi.generateQuestions({
            role: a.roleName,
            competencies: a.competencies,
            weakCompetencies: weak,
            experienceText: [a.experience.text, a.experience.jobs, a.experience.training].filter(Boolean).join('\n'),
            language: a.profile.language,
          });
          const questions = res.questions.map((q) => ({ ...q, id: q.id || makeId('q') }));
          const next = { ...a, questions };
          setAssessment(next);
          saveAssessment(next);
        } catch {
          // Transport-level failure: keep the assessment moving with the built-in question set.
          const { RPL_FALLBACK_QUESTIONS } = await import('../../rpl/fallbackQuestions');
          const questions: RplQuestion[] = RPL_FALLBACK_QUESTIONS.map((q, i) => ({
            ...q,
            id: `q${i + 1}`,
          })) as unknown as RplQuestion[];
          const next = { ...a, questions };
          setAssessment(next);
          saveAssessment(next);
        }
      }
      setQIndex(0);
      setCurrentEval(null);
    },
    [],
  );

  const submitAnswer = useCallback(
    async (payload: { text?: string; chosen?: number }) => {
      if (!assessment) return;
      const q = assessment.questions[qIndex];
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
      setCurrentEval(evaluation);
      setEvaluating(false);
    },
    [assessment, qIndex],
  );

  const nextQuestion = useCallback(() => {
    setCurrentEval(null);
    setQIndex((i) => {
      const nextIdx = i + 1;
      if (!assessment) return nextIdx;
      if (nextIdx >= assessment.questions.length) {
        // Finish: gaps + readiness, then results.
        const gaps = computeGaps(assessment.mappings, assessment.answers, assessment.questions);
        const readiness = computeReadiness(assessment);
        const done: RplAssessment = { ...assessment, gaps, readiness, status: 'assessed' };
        saveAssessment(done);
        setAssessment(done);
        clearActiveDraft();
        setPhase('results');
      }
      return nextIdx;
    });
  }, [assessment]);

  const generateReport = useCallback(async () => {
    if (!assessment) return;
    setReportLoading(true);
    const answered = Object.values(assessment.answers).filter((a) => a.text || a.chosen !== undefined).length;
    try {
      const res = await rplApi.report({
        profile: assessment.profile as unknown as Record<string, string>,
        role: assessment.roleName,
        competencies: assessment.competencies,
        mappings: assessment.mappings,
        skills: assessment.skills,
        gaps: assessment.gaps ?? { demonstrated: [], needsMoreEvidence: [], learningGaps: [] },
        readiness: (assessment.readiness ?? { experienceEvidence: 0, competencyCoverage: 0, assessmentPerformance: 0, evidenceCompleteness: 0, overall: 0 }) as unknown as Record<string, number>,
        assessmentSummary: { answered, total: assessment.questions.length },
        evidence: assessment.evidence.map((e) => ({ name: e.name, kind: e.kind, status: e.status })),
      });
      const done: RplAssessment = { ...assessment, report: res.report, status: 'complete' };
      saveAssessment(done);
      setAssessment(done);
    } catch {
      // Keep the promise: the report screen still shows the local analysis.
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
        onContinue={() => void startQuestions(assessment)}
        onRegenerate={() => void runAnalysis(assessment)}
      />
    );
  }

  if (phase === 'questions') {
    const q = assessment.questions[qIndex];
    if (!q) {
      // Questions failed to load entirely — recover gracefully.
      return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="mt-4 text-ink-soft">Questions could not be loaded. Please try again.</p>
          <button onClick={() => { const a = { ...assessment, questions: [] }; setAssessment(a); saveAssessment(a); void startQuestions(a); }} className="btn btn-primary btn-lg mt-4">Retry</button>
        </div>
      );
    }
    return (
      <>
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={qIndex} aria-valuemin={0} aria-valuemax={assessment.questions.length}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all" style={{ width: `${((qIndex + (currentEval ? 1 : 0)) / assessment.questions.length) * 100}%` }} />
          </div>
        </div>
        <RplQuestionCard
          key={q.id}
          question={q}
          index={qIndex}
          total={assessment.questions.length}
          evaluating={evaluating}
          evaluation={currentEval}
          onSubmit={(p) => void submitAnswer(p)}
          onNext={nextQuestion}
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
    />
  );
}
