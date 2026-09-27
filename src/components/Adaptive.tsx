import { ArrowRight, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import type { AdaptiveExplanation, WeakConceptInfo } from '../types';

interface AdaptiveProps {
  explanation: AdaptiveExplanation | null;
  weak: WeakConceptInfo[];
  loading: boolean;
  error: string | null;
  onRetryLoad: () => void;
  onContinue: () => void;
  round: number;
}

export default function Adaptive({
  explanation,
  weak,
  loading,
  error,
  onRetryLoad,
  onContinue,
  round,
}: AdaptiveProps) {
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-brand-100">
          <RefreshCw className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold text-ink">The AI is rethinking its explanation…</h1>
        <p className="mt-2 text-ink-soft">It's switching teaching strategies based on your answers.</p>
      </div>
    );
  }

  if (error || !explanation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-bad">{error || 'Something went wrong while preparing the new explanation.'}</p>
        <button onClick={onRetryLoad} className="btn btn-ghost btn-lg mt-5">Try Again</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* What the AI noticed */}
      <section className="animate-fade-up card border-amber-100 bg-amber-50/50 p-6" aria-label="Weak concept identified">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-700">
          <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
          The AI noticed something
        </h2>
        <div className="mt-3.5 space-y-3">
          {weak.map((w) => (
            <div key={w.concept} className="rounded-xl border border-amber-100 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="pill border-bad-line bg-bad-soft text-bad">Needs improvement</span>
                <span className="text-ink-faint">Round {round}</span>
              </div>
              <div className="mt-2.5 font-display text-base font-bold text-ink">{w.concept}</div>
              <p className="mt-1 text-sm text-ink-soft">
                You answered “{w.question.question}” incorrectly.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* AI adaptation banner */}
      <div className="animate-fade-up mt-4 flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700" style={{ animationDelay: '0.05s' }}>
        <RefreshCw className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
        AI changed the way it explained this concept based on your answer.
      </div>

      {/* New explanation */}
      <section className="animate-fade-up card mt-4 p-6 sm:p-7" style={{ animationDelay: '0.1s' }} aria-label="Adaptive explanation">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill border-brand-200 bg-brand-50 text-brand-700">New approach: {explanation.approach}</span>
          <span className="text-xs text-ink-faint">Re-explaining: {explanation.concept}</span>
        </div>
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink">Let's look at this differently</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{explanation.explanation}</p>

        <div className="mt-5 rounded-xl border border-good-line bg-good-soft p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-good">
            <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
            Key idea
          </div>
          <p className="mt-1 text-sm font-medium text-emerald-900">{explanation.keyIdea}</p>
        </div>

        <button onClick={onContinue} className="btn btn-primary btn-xl mt-6 w-full">
          Try a Similar Question
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
