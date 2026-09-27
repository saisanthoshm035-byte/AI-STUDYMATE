import { ArrowRight, CheckCircle2, Clock, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import RetentionPanel from './RetentionPanel';
import { buildRetentionReport } from '../lib/retention';
import type { Attempt, LearningSession, TeachBackAnalysis } from '../types';

interface SummaryProps {
  session: LearningSession;
  attempts: Attempt[];
  /** Intelligence layer (optional): teach-back result + review attempts feed retention. */
  teachBack?: TeachBackAnalysis | null;
  reviewAttempts?: Attempt[];
  onGoHome: () => void;
  onLearnAgain: () => void;
  onStartTeachBack?: () => void;
  onStartReview?: () => void;
}

function xpFor(session: LearningSession): number {
  let xp = 50; // lesson completed
  xp += 20; // quiz completed
  xp += 30 * session.improvedConcepts.length; // each weak concept mastered on retry
  return xp;
}

function narrative(session: LearningSession): string {
  const topic = session.topic;
  const weak = session.weakConcepts;
  const improved = session.improvedConcepts;

  if (session.initialScore === 100 && (session.retryScore === null || session.retryScore === 100)) {
    return `You understood the core concepts of ${topic} on your first pass — a perfect score. The AI verified your understanding with concept-based questions, and nothing needed re-teaching. Ready for the next topic!`;
  }

  if (session.retryScore === null) {
    return `You understood ${session.initialScore}% of ${topic} on the first pass. No adaptation was needed this time — try a harder topic or a higher level next.`;
  }

  if (improved.length > 0) {
    const what = weak[0] ? `“${weak[0]}”` : 'a key concept';
    return `You understood the core concepts of ${topic}. You initially struggled with ${what}, but after an adaptive re-explanation you answered the follow-up correctly — improvement measured, not assumed.`;
  }

  const what = weak[0] ? `“${weak[0]}”` : 'this concept';
  return `You reached ${session.initialScore}% on ${topic}. Even after a new explanation, the re-test shows ${what} still needs work — a good topic to revisit soon.`;
}

export default function Summary({
  session,
  attempts,
  teachBack = null,
  reviewAttempts = [],
  onGoHome,
  onLearnAgain,
  onStartTeachBack,
  onStartReview,
}: SummaryProps) {
  const retentionReport =
    attempts.length > 0
      ? buildRetentionReport(session.topic, attempts, teachBack, reviewAttempts)
      : null;
  const initial = `${session.initialScore}%`;
  const retry = session.retryScore === null ? null : `${session.retryScore}%`;
  const improved = session.retryScore !== null && session.retryScore > session.initialScore;
  const missedCount = Math.round(((100 - session.initialScore) / 100) * session.totalQuestions);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="animate-fade-up card overflow-hidden">
        <div className="border-b border-line bg-gradient-to-r from-good-soft to-accent-50 px-7 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-good text-white shadow-lg">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Learning complete</h1>
          <p className="mt-1.5 text-ink-soft">
            {session.topic} · {session.level}
          </p>
        </div>

        <div className="p-7">
          {/* Score comparison */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-canvas/60 p-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Initial score</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-ink">{initial}</div>
              <div className="mt-1 text-xs text-ink-faint">
                {session.totalQuestions - missedCount} of {session.totalQuestions} correct
              </div>
            </div>
            <div
              className={`rounded-xl border p-5 text-center ${
                improved ? 'border-good-line bg-good-soft' : 'border-line bg-canvas/60'
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">After adaptive re-test</div>
              <div className={`mt-1 font-display text-3xl font-extrabold ${improved ? 'text-good' : 'text-ink'}`}>
                {retry ?? '—'}
              </div>
              <div className="mt-1 text-xs text-ink-faint">
                {improved ? 'Improvement measured — not assumed' : 'No re-test was needed'}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-white p-4 text-center">
              <Target className="mx-auto h-4.5 w-4.5 text-brand-600" aria-hidden="true" />
              <div className="mt-1.5 font-display text-xl font-extrabold text-ink">{session.masteredConcepts.length}</div>
              <div className="text-xs text-ink-faint">Concepts mastered</div>
            </div>
            <div className="rounded-xl border border-line bg-white p-4 text-center">
              <TrendingUp className="mx-auto h-4.5 w-4.5 text-good" aria-hidden="true" />
              <div className="mt-1.5 font-display text-xl font-extrabold text-ink">{session.improvedConcepts.length}</div>
              <div className="text-xs text-ink-faint">Concepts improved</div>
            </div>
            <div className="rounded-xl border border-line bg-white p-4 text-center">
              <Clock className="mx-auto h-4.5 w-4.5 text-accent-600" aria-hidden="true" />
              <div className="mt-1.5 font-display text-xl font-extrabold text-ink">{session.durationMinutes}m</div>
              <div className="text-xs text-ink-faint">Learning time</div>
            </div>
          </div>

          {/* XP */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-5 py-3.5">
            <Zap className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <div className="text-sm font-semibold text-amber-700">
              +{xpFor(session)} XP earned this session
              <span className="ml-1 font-normal text-amber-600/80">
                ({session.retryScore !== null ? 'lesson + quiz + adaptation' : 'lesson + quiz'})
              </span>
            </div>
          </div>

          {/* AI narrative */}
          <section
            className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-accent-50 p-6"
            aria-label="AI learning summary"
          >
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <Sparkles className="h-4.5 w-4.5 text-brand-600" aria-hidden="true" />
              Your AI Learning Summary
            </h2>
            <p className="mt-2.5 leading-relaxed text-ink-soft">{narrative(session)}</p>
          </section>

          {/* Concept chips */}
          {(session.masteredConcepts.length > 0 || session.improvedConcepts.length > 0) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {session.masteredConcepts
                .filter((c) => !session.improvedConcepts.includes(c))
                .map((c) => (
                  <span key={`m-${c}`} className="pill border-good-line bg-good-soft text-good">
                    {c} ✓
                  </span>
                ))}
              {session.improvedConcepts.map((c) => (
                <span key={`i-${c}`} className="pill border-good-line bg-good-soft text-good">
                  {c} ↑ mastered after re-teach
                </span>
              ))}
            </div>
          )}

          {/* Intelligence layer: teach-back + retention (additive sections) */}
          {(onStartTeachBack || retentionReport) && (
            <section
              className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-accent-50 p-6"
              aria-label="Explain what you learned"
            >
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                🧠 Prove Your Understanding
              </h2>
              {teachBack ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Teach-back complete — the AI found your biggest gap and you answered targeted questions on it. Your
                  retention estimate below already includes it.
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Explain {session.topic} in your own words and the AI will check your{' '}
                  <strong className="text-ink">understanding</strong> — not your writing style.
                </p>
              )}
              {onStartTeachBack && (
                <button onClick={onStartTeachBack} className="btn btn-ghost btn-lg mt-4">
                  {teachBack ? 'Teach It Back Again' : '🧠 Teach It Back'}
                </button>
              )}
            </section>
          )}

          {retentionReport && onStartReview && (
            <RetentionPanel report={retentionReport} onStartReview={onStartReview} />
          )}

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={onLearnAgain} className="btn btn-primary btn-xl flex-1">
              Learn Something New
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <button onClick={onGoHome} className="btn btn-ghost btn-xl flex-1">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
