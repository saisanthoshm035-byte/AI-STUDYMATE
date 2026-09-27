import { AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { ProgressBar } from './ui';
import { buildConfidenceSummary } from '../lib/confidence';
import type { Attempt, ConfidenceSummary, Lesson } from '../types';

const STATE_META = {
  strong: { emoji: '🟢', label: 'Strong understanding', cls: 'text-good' },
  underconfident: { emoji: '🟡', label: 'Under-confident', cls: 'text-amber-600' },
  gap: { emoji: '🟡', label: 'Knowledge gaps', cls: 'text-amber-600' },
  misconception: { emoji: '🔴', label: 'Potential misconceptions', cls: 'text-bad' },
} as const;

/** STATE_META keys → ConfidenceSummary fields. */
const STATE_COUNT: Record<keyof typeof STATE_META, (cs: ConfidenceSummary) => number> = {
  strong: (cs) => cs.strong,
  underconfident: (cs) => cs.underconfident,
  gap: (cs) => cs.gaps,
  misconception: (cs) => cs.misconceptions,
};

interface AnalysisProps {
  lesson: Lesson;
  attempts: Attempt[];
  onContinue: () => void;
}

export default function Analysis({ lesson, attempts, onContinue }: AnalysisProps) {
  const correct = attempts.filter((a) => a.correct).length;
  const total = attempts.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const missed = attempts.filter((a) => !a.correct);
  const understood = attempts.filter((a) => a.correct).map((a) => a.question.concept);
  const weak = missed.map((a) => a.question.concept);

  const uniqueUnderstood = [...new Set(understood)];
  const uniqueWeak = [...new Set(weak)];

  const message = buildMessage(pct, uniqueWeak);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="animate-fade-up card overflow-hidden">
        <div className="border-b border-line bg-gradient-to-r from-brand-50 to-accent-50 px-7 py-6 text-center">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Your learning snapshot</h1>
          <p className="mt-1 text-sm text-ink-soft">{lesson.topic} · {lesson.level}</p>

          <div className="mt-6 flex items-end justify-center gap-1.5">
            <span className="font-display text-5xl font-extrabold text-ink">{correct}</span>
            <span className="pb-1.5 font-display text-xl font-bold text-ink-faint">/ {total}</span>
            <span className="pb-1.5 ml-2 font-display text-2xl font-extrabold text-brand-600">{pct}%</span>
          </div>
          <div className="mx-auto mt-4 max-w-sm">
            <ProgressBar value={pct} />
          </div>
        </div>

        <div className="p-7">
          <p className="rounded-xl bg-canvas px-5 py-4 text-center text-[15px] font-medium leading-relaxed text-ink">
            {message}
          </p>

          {uniqueUnderstood.length > 0 && (
            <section className="mt-6" aria-label="Concepts understood">
              <h2 className="flex items-center gap-2 text-sm font-bold text-good">
                <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
                Concepts understood ({uniqueUnderstood.length})
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {uniqueUnderstood.map((c) => (
                  <span key={c} className="pill border-good-line bg-good-soft text-good">{c}</span>
                ))}
              </div>
            </section>
          )}

          {uniqueWeak.length > 0 && (
            <section className="mt-5" aria-label="Concepts needing attention">
              <h2 className="flex items-center gap-2 text-sm font-bold text-bad">
                <AlertCircle className="h-4.5 w-4.5" aria-hidden="true" />
                Concepts needing attention ({uniqueWeak.length})
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {uniqueWeak.map((c) => (
                  <span key={c} className="pill border-bad-line bg-bad-soft text-bad">{c}</span>
                ))}
              </div>
            </section>
          )}

          {/* Confidence vs Knowledge (intelligence layer — only when confidence data exists) */}
          {attempts.some((a) => a.confidence) && (() => {
            const cs = buildConfidenceSummary(attempts);
            return (
              <section className="mt-6 rounded-xl border border-line bg-canvas/50 p-5" aria-label="Confidence vs knowledge">
                <h2 className="text-sm font-bold text-ink">📊 Confidence vs Knowledge</h2>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {(Object.keys(STATE_META) as (keyof typeof STATE_META)[]).map((k) => (
                    <div key={k} className="rounded-lg bg-white px-3 py-2.5 text-center ring-1 ring-line">
                      <div className={`font-display text-lg font-extrabold ${STATE_META[k].cls}`}>
                        {STATE_META[k].emoji} {STATE_COUNT[k](cs)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium leading-tight text-ink-faint">
                        {STATE_META[k].label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{cs.insight}</p>
              </section>
            );
          })()}

          {uniqueWeak.length > 0 && (
            <div className="mt-7 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-ink-soft">
              On the next screen, your AI tutor will re-explain{' '}
              {uniqueWeak.length === 1 ? (
                <strong className="text-ink">{uniqueWeak[0]}</strong>
              ) : (
                <>the {uniqueWeak.length} concepts above</>
              )}{' '}
              using a different approach.
            </div>
          )}

          <button onClick={onContinue} className="btn btn-primary btn-xl mt-7 w-full">
            {uniqueWeak.length > 0 ? 'Show Me a Different Explanation' : 'Finish & See Summary'}
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildMessage(pct: number, weak: string[]): string {
  if (pct === 100) {
    return 'Outstanding — you understood every concept. You have mastered the fundamentals of this lesson.';
  }
  if (pct >= 80) {
    return `You've understood the fundamentals, but you may need another explanation of ${weak[0]} — that's exactly what adaptive learning is for.`;
  }
  if (pct >= 60) {
    return `Solid start — the core ideas are there, but ${weak.length === 1 ? weak[0] : `${weak.length} concepts`} could use a different explanation to really click.`;
  }
  if (pct >= 40) {
    return `You've got part of the picture. Let's re-teach ${weak.length === 1 ? weak[0] : `${weak.length} concepts`} from a different angle before moving on.`;
  }
  return "This one's worth another pass — the AI will re-explain the key concepts differently and we'll re-test what you've learned.";
}
