import Quiz from './Quiz';
import type { Attempt, QuizQuestion } from '../types';

interface RetryProps {
  questions: QuizQuestion[];
  conceptLabel: string;
  round: number;
  onComplete: (attempts: Attempt[]) => void;
  loading: boolean;
  error: string | null;
  onRetryLoad: () => void;
}

export default function Retry({ questions, conceptLabel, round, onComplete, loading, error, onRetryLoad }: RetryProps) {
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-brand-100">
          <span className="h-7 w-7 animate-spin rounded-full border-3 border-brand-600 border-t-transparent" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold text-ink">Preparing your follow-up question…</h1>
        <p className="mt-2 text-ink-soft">Testing whether the new explanation helped.</p>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-bad">{error || 'Something went wrong while preparing the follow-up question.'}</p>
        <button onClick={onRetryLoad} className="btn btn-ghost btn-lg mt-5">Try Again</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill border-brand-200 bg-brand-50 text-brand-700">
            Round {round} · Retry
          </span>
          <span className="pill">{conceptLabel}</span>
          <span className="text-sm text-ink-faint">Let's check if that explanation helped.</span>
        </div>
      </div>
      <Quiz
        questions={questions}
        title={`Retry · ${conceptLabel}`}
        subtitle="Different angle, same concept — answerable from the new explanation."
        onComplete={onComplete}
      />
    </div>
  );
}
