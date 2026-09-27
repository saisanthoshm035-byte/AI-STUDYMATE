import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Navbar from './components/Navbar';
import Landing from './components/Landing';
import Setup from './components/Setup';
import Generating from './components/Generating';
import LessonView from './components/Lesson';
import Quiz from './components/Quiz';
import Analysis from './components/Analysis';
import Adaptive from './components/Adaptive';
import Retry from './components/Retry';
import Summary from './components/Summary';
import TeachBack from './components/TeachBack';
import Progress from './components/Progress';
import ErrorScreen from './components/ErrorScreen';
import { api } from './lib/api';
import { demoAdapt, demoLesson, demoRetry, demoReview } from './lib/demoFallback';
import { buildRetentionReport } from './lib/retention';
import { addXp, loadSessions, saveSession } from './lib/storage';
import { stopSpeaking } from './lib/speech';
import type {
  AdaptiveExplanation,
  AiStatus,
  Attempt,
  Goal,
  LearningSession,
  Lesson,
  Level,
  QuizQuestion,
  ReviewPack,
  Screen,
  TeachBackAnalysis,
  WeakConceptInfo,
} from './types';

interface SetupInput {
  topic: string;
  level: Level;
  goal: Goal;
  time: string;
}

interface AdaptiveResult {
  concept: string;
  approach: string;
  fixed: boolean;
  attempts: number;
}

const MAX_ATTEMPTS_PER_CONCEPT = 3;

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  const [setupInput, setSetupInput] = useState<SetupInput>({
    topic: '',
    level: 'Beginner',
    goal: 'Understand the basics',
    time: '10',
  });

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);

  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const [weakQueue, setWeakQueue] = useState<WeakConceptInfo[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [attemptNum, setAttemptNum] = useState(1);
  const [adaptiveResults, setAdaptiveResults] = useState<AdaptiveResult[]>([]);
  const [round, setRound] = useState(1);

  const [adaptive, setAdaptive] = useState<AdaptiveExplanation | null>(null);
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [adaptiveError, setAdaptiveError] = useState<string | null>(null);

  const [retryQ, setRetryQ] = useState<QuizQuestion | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState<Attempt[]>([]);

  // Intelligence layer (additive): teach-back + quick review state.
  // The existing flow never reads these — they only feed the new screens.
  const [teachBack, setTeachBack] = useState<TeachBackAnalysis | null>(null);
  const [reviewPack, setReviewPack] = useState<ReviewPack | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewAttempts, setReviewAttempts] = useState<Attempt[]>([]);
  const [reviewRound, setReviewRound] = useState(0);

  const [session, setSession] = useState<LearningSession | null>(null);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  // Fetch AI status once for the navbar badge
  useEffect(() => {
    api
      .status()
      .then(setAiStatus)
      .catch(() => setAiStatus({ configured: false, provider: 'demo', model: 'Demo Engine', label: 'Demo Engine', demo: true }));
  }, []);

  // Reset scroll + stop any narration on screen change
  useEffect(() => {
    window.scrollTo({ top: 0 });
    stopSpeaking();
  }, [screen]);

  // ---------------------------------------------------------------- helpers

  const go = useCallback((s: Screen) => setScreen(s), []);

  const goSetup = useCallback((presetTopic = '') => {
    setSetupInput((prev) => ({ ...prev, topic: presetTopic || prev.topic }));
    setScreen('setup');
  }, []);

  // ------------------------------------------------------------- generation

  const generate = useCallback(
    async (input: SetupInput) => {
      setSetupInput(input);
      setGenerateError(null);
      setStartedAt(Date.now());        setScreen('generating');
      try {
        let l: Lesson;
        try {
          l = await api.generateLesson({
            topic: input.topic,
            level: input.level,
            goal: input.goal,
            time: input.time,
          });
        } catch {
          // Worst-case resilience: never show an error screen during a demo.
          l = demoLesson(input.topic, input.level, input.goal, input.time);
        }
        setLesson(l);
        setAttempts([]);
        setWeakQueue([]);
        setQueueIndex(0);
        setAttemptNum(1);
        setAdaptiveResults([]);
        setRound(1);
        setAdaptive(null);
        setRetryQ(null);
        setRetryAttempts([]);
        setTeachBack(null);
        setReviewPack(null);
        setReviewError(null);
        setReviewAttempts([]);
        setSession(null);
        setScreen('lesson');
      } catch (err) {
        setGenerateError(
          err instanceof Error
            ? `${err.message}. Your AI tutor may be busy — please try again.`
            : 'Your AI tutor is taking a little longer than expected. Please try again.',
        );
        setScreen('error');
      }
    },
    [],
  );

  // ------------------------------------------------------------ quiz → analysis

  const onQuizComplete = useCallback((result: Attempt[]) => {
    setAttempts(result);
    const weak = result.filter((a) => !a.correct).map((a) => ({
      concept: a.question.concept,
      question: a.question,
      chosen: a.chosen,
    }));
    setWeakQueue(weak);
    setQueueIndex(0);
    setAttemptNum(1);
    setScreen('analysis');
  }, []);

  // --------------------------------------------------------------- adaptive

  const currentWeak: WeakConceptInfo | null = weakQueue[queueIndex] ?? null;

  const fetchAdaptive = useCallback(async () => {
    if (!currentWeak || !lesson) return;
    setAdaptiveLoading(true);
    setAdaptiveError(null);
    setAdaptive(null);
    try {
      const exp = await api.adapt({
        topic: lesson.topic,
        level: lesson.level,
        concept: currentWeak.concept,
        question: currentWeak.question.question,
        correctAnswer: currentWeak.question.options[currentWeak.question.correctAnswer],
        chosen: currentWeak.question.options[currentWeak.chosen] ?? '',
      });
      setAdaptive(exp);
    } catch {
      // Never break the loop — fall back to the built-in adaptation.
      setAdaptive(demoAdapt(currentWeak.concept, lesson.topic));
    } finally {
      setAdaptiveLoading(false);
    }
  }, [currentWeak, lesson, attemptNum]);

  useEffect(() => {
    if (screen === 'adaptive' && !adaptive && !adaptiveLoading && !adaptiveError) {
      void fetchAdaptive();
    }
  }, [screen, adaptive, adaptiveLoading, adaptiveError, fetchAdaptive]);

  const fetchRetryQuestion = useCallback(async () => {
    if (!currentWeak || !lesson) return;
    setRetryLoading(true);
    setRetryError(null);
    setRetryQ(null);
    try {
      const q = await api.retryQuestion({
        topic: lesson.topic,
        level: lesson.level,
        concept: currentWeak.concept,
        previousQuestion: currentWeak.question.question,
      });
      setRetryQ(q);
    } catch {
      // Never break the loop — fall back to the built-in follow-up question.
      setRetryQ(demoRetry(currentWeak.concept, lesson.topic));
    } finally {
      setRetryLoading(false);
    }
  }, [currentWeak, lesson]);

  useEffect(() => {
    if (screen === 'retry' && !retryQ && !retryLoading && !retryError) {
      void fetchRetryQuestion();
    }
  }, [screen, retryQ, retryLoading, retryError, fetchRetryQuestion]);

  // -------------------------------------------------------- retry resolution

  const advanceQueue = useCallback(
    (fixed: boolean) => {
      const concept = currentWeak?.concept ?? 'Unknown';
      setAdaptiveResults((prev) => [
        ...prev.filter((r) => r.concept !== concept),
        { concept, approach: adaptive?.approach ?? '', fixed, attempts: attemptNum },
      ]);
      setAdaptive(null);
      setRetryQ(null);
      setAttemptNum(1);
      setRound(1);
      setQueueIndex((i) => i + 1);
    },
    [currentWeak, adaptive, attemptNum],
  );

  const finalize = useCallback(
    (allAttempts: Attempt[], retryAtts: Attempt[], results: AdaptiveResult[]) => {
      if (!lesson) return;
      const total = allAttempts.length || 1;
      const initialScore = Math.round((allAttempts.filter((a) => a.correct).length / total) * 100);
      const weakConcepts = [...new Set(results.map((r) => r.concept))];
      const improvedConcepts = results.filter((r) => r.fixed).map((r) => r.concept);
      const masteredConcepts = [
        ...new Set([...allAttempts.filter((a) => a.correct).map((a) => a.question.concept), ...improvedConcepts]),
      ];
      const retryScore =
        retryAtts.length > 0
          ? Math.round((retryAtts.filter((a) => a.correct).length / retryAtts.length) * 100)
          : null;

      const s: LearningSession = {
        id: makeId(),
        topic: lesson.topic,
        level: lesson.level,
        initialScore,
        retryScore,
        totalQuestions: allAttempts.length,
        weakConcepts,
        masteredConcepts,
        improvedConcepts,
        durationMinutes: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
        createdAt: Date.now(),
      };
      setSession(s);
      saveSession(s);
      addXp(50 + 20 + 30 * improvedConcepts.length);
      setSessionsVersion((v) => v + 1);
      setScreen('summary');
    },
    [lesson, startedAt],
  );

  const onAnalysisContinue = useCallback(() => {
    if (weakQueue.length === 0) {
      finalize(attempts, [], []);
      return;
    }
    setScreen('adaptive');
  }, [weakQueue.length, attempts, finalize]);

  const onRetryComplete = useCallback(
    (result: Attempt[]) => {
      setRetryAttempts((prev) => [...prev, ...result]);
      const attempt = result[0];
      if (attempt && attempt.correct) {
        // Concept conquered — move to the next weak concept or finish
        advanceQueue(true);
        if (queueIndex + 1 >= weakQueue.length) {
          finalize(attempts, [...retryAttempts, ...result], [
            ...adaptiveResults.filter((r) => r.concept !== currentWeak?.concept),
            { concept: currentWeak?.concept ?? '', approach: adaptive?.approach ?? '', fixed: true, attempts: attemptNum },
          ]);
        } else {
          setScreen('adaptive');
        }
      } else {
        // Wrong again — another, simpler explanation (bounded retries)
        const nextAttempt = attemptNum + 1;
        if (nextAttempt > MAX_ATTEMPTS_PER_CONCEPT) {
          advanceQueue(false);
          if (queueIndex + 1 >= weakQueue.length) {
            finalize(attempts, [...retryAttempts, ...result], [
              ...adaptiveResults.filter((r) => r.concept !== currentWeak?.concept),
              { concept: currentWeak?.concept ?? '', approach: adaptive?.approach ?? '', fixed: false, attempts: attemptNum },
            ]);
          } else {
            setScreen('adaptive');
          }
        } else {
          setAttemptNum(nextAttempt);
          setRound((r) => r + 1);
          setAdaptive(null);
          setRetryQ(null);
          setScreen('adaptive');
        }
      }
    },
    [advanceQueue, adaptiveResults, adaptive, attemptNum, attempts, currentWeak, finalize, queueIndex, retryAttempts, weakQueue.length],
  );

  // ------------------------------------------- teach-back + quick review

  const onTeachBackDone = useCallback(
    (analysis: TeachBackAnalysis | null) => {
      if (analysis) setTeachBack(analysis);
      // From the summary → stay there (retention updates live).
      // From the lesson (no session yet) → return to the lesson.
      go(session ? 'summary' : 'lesson');
    },
    [go, session],
  );

  const startReview = useCallback(() => {
    setReviewPack(null);
    setReviewError(null);
    setReviewRound((r) => r + 1);
    go('review');
  }, [go]);

  const fetchReviewPack = useCallback(async () => {
    if (!lesson) return;
    // Focus the review on the concepts the retention model is least sure about.
    const report = buildRetentionReport(lesson.topic, attempts, teachBack, [
      ...retryAttempts,
      ...reviewAttempts,
    ]);
    const weakest = report.concepts
      .filter((c) => c.review_priority !== 'strong')
      .slice(0, 3)
      .map((c) => c.concept);
    const concepts = weakest.length > 0 ? weakest : (session?.weakConcepts.slice(0, 3) ?? []);
    setReviewLoading(true);
    setReviewError(null);
    try {
      const pack = await api.reviewPack({ topic: lesson.topic, level: lesson.level, concepts });
      setReviewPack(pack);
    } catch {
      // Failure safety: the built-in review pack keeps the loop working.
      try {
        setReviewPack(demoReview(lesson.topic, concepts));
      } catch {
        setReviewError('The quick review could not be loaded right now. Your progress is saved — please try again.');
      }
    } finally {
      setReviewLoading(false);
    }
  }, [lesson, attempts, teachBack, retryAttempts, reviewAttempts, session]);

  useEffect(() => {
    if (screen === 'review' && !reviewPack && !reviewLoading && !reviewError) {
      void fetchReviewPack();
    }
  }, [screen, reviewPack, reviewLoading, reviewError, fetchReviewPack]);

  const onReviewComplete = useCallback(
    (result: Attempt[]) => {
      setReviewAttempts((prev) => [...prev, ...result]);
      setReviewPack(null);
      // Back to the summary — the retention estimate now reflects the review.
      go('summary');
    },
    [go],
  );

  const onLearnAgain = useCallback(() => {
    setLesson(null);
    setSession(null);
    setScreen('setup');
  }, []);

  // ---------------------------------------------------------------- render

  return (
    <div className="sf-app flex min-h-screen flex-col">
      <Navbar
        status={aiStatus}
        onStartLearning={() => goSetup()}
        onGoHome={() => go('landing')}
        onGoProgress={() => go('progress')}
      />

      <main className="flex-1">
        {screen === 'landing' && (
          <Landing status={aiStatus} onStart={() => goSetup()} onPickTopic={(t) => goSetup(t)} />
        )}

        {screen === 'setup' && (
          <Setup initialTopic={setupInput.topic} onGenerate={generate} onBack={() => go('landing')} />
        )}

        {screen === 'generating' && <Generating topic={setupInput.topic} level={setupInput.level} />}

        {screen === 'lesson' && lesson && (
          <LessonView
            lesson={lesson}
            onStartQuiz={() => go('quiz')}
            onRegenerate={() => void generate(setupInput)}
            onTeachBack={() => go('teachback')}
          />
        )}

        {screen === 'quiz' && lesson && (
          <Quiz
            key={`quiz-${lesson.topic}`}
            questions={lesson.quiz}
            title={`Quiz · ${lesson.topic}`}
            subtitle="One question at a time. Each answer tells the AI which concept it measures."
            onComplete={onQuizComplete}
            collectConfidence
          />
        )}

        {screen === 'analysis' && lesson && (
          <Analysis lesson={lesson} attempts={attempts} onContinue={onAnalysisContinue} />
        )}

        {screen === 'adaptive' && currentWeak && (
          <Adaptive
            explanation={adaptive}
            weak={[currentWeak]}
            loading={adaptiveLoading}
            error={adaptiveError}
            onRetryLoad={() => {
              setAdaptiveError(null);
              setAdaptive(null);
            }}
            onContinue={() => go('retry')}
            round={round}
          />
        )}

        {screen === 'retry' && currentWeak && (
          <Retry
            key={`retry-${queueIndex}-${round}`}
            questions={retryQ ? [retryQ] : []}
            conceptLabel={currentWeak.concept}
            round={round}
            loading={retryLoading}
            error={retryError}
            onRetryLoad={() => {
              setRetryError(null);
              setRetryQ(null);
            }}
            onComplete={onRetryComplete}
          />
        )}

        {screen === 'teachback' && lesson && (
          <TeachBack
            topic={lesson.topic}
            level={lesson.level}
            keyConcepts={lesson.keyConcepts.map((c) => c.title)}
            onDone={onTeachBackDone}
            onSkip={() => go(session ? 'summary' : 'lesson')}
          />
        )}

        {screen === 'review' &&
          (reviewLoading ? (
            <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-600" aria-hidden="true" />
              <h1 className="mt-6 font-display text-2xl font-extrabold text-ink">Preparing your quick review…</h1>
              <p className="mt-2 text-ink-soft">Focusing on the concepts most at risk of fading.</p>
            </div>
          ) : reviewError ? (
            <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
              <div className="card p-7 text-center">
                <h1 className="font-display text-xl font-extrabold text-ink">Review unavailable</h1>
                <p className="mt-2 text-sm text-ink-soft">{reviewError}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => {
                      setReviewError(null);
                      setReviewPack(null);
                    }}
                    className="btn btn-primary btn-lg flex-1"
                  >
                    Try Again
                  </button>
                  <button onClick={() => go('summary')} className="btn btn-ghost btn-lg flex-1">
                    Back to Summary
                  </button>
                </div>
              </div>
            </div>
          ) : reviewPack ? (
            <div>
              <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
                <span className="pill border-brand-200 bg-brand-50 text-brand-700">🔄 Quick Review</span>
                <p className="mt-2 text-sm text-ink-soft">{reviewPack.intro}</p>
              </div>
              <Quiz
                key={`review-${reviewRound}`}
                questions={reviewPack.questions}
                title={`Quick Review · ${reviewPack.topic}`}
                subtitle="Lock in the concepts that fade first."
                onComplete={onReviewComplete}
              />
            </div>
          ) : null)}

        {screen === 'summary' && session && (
          <Summary
            session={session}
            attempts={attempts}
            teachBack={teachBack}
            reviewAttempts={[...retryAttempts, ...reviewAttempts]}
            onGoHome={() => go('landing')}
            onLearnAgain={onLearnAgain}
            onStartTeachBack={() => go('teachback')}
            onStartReview={startReview}
          />
        )}

        {screen === 'progress' && (
          <Progress
            key={sessionsVersion}
            sessions={loadSessions()}
            onChange={() => setSessionsVersion((v) => v + 1)}
            onStart={() => goSetup()}
          />
        )}

        {screen === 'error' && (
          <ErrorScreen
            message={generateError ?? 'Something went wrong.'}
            onRetry={() => void generate(setupInput)}
            onBack={() => go('setup')}
          />
        )}
      </main>
    </div>
  );
}