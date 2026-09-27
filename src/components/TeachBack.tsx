import { useState } from 'react';
import { ArrowRight, CheckCircle2, Lightbulb, Loader2, RotateCcw, Send, Sparkles, Target, XCircle } from 'lucide-react';
import Quiz from './Quiz';
import { api } from '../lib/api';
import { demoTeachBack } from '../lib/demoFallback';
import type { Attempt, TeachBackAnalysis } from '../types';

interface TeachBackProps {
  topic: string;
  level: string;
  keyConcepts: string[];
  onDone: (result: TeachBackAnalysis | null) => void;
  onSkip: () => void;
}

type Phase = 'write' | 'analyzing' | 'result' | 'quiz';

export default function TeachBack({ topic, level, keyConcepts, onDone, onSkip }: TeachBackProps) {
  const [phase, setPhase] = useState<Phase>('write');
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<TeachBackAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followUpAttempts, setFollowUpAttempts] = useState<Attempt[]>([]);
  const [followUpDone, setFollowUpDone] = useState(false);

  const minChars = 40;

  const analyze = async () => {
    if (text.trim().length < minChars) return;
    setPhase('analyzing');
    setError(null);
    try {
      const result = await api.analyzeTeachBack({ topic, level, explanation: text.trim(), keyConcepts });
      setAnalysis(result);
    } catch {
      // Failure safety: fall back to the built-in analyzer rather than blocking the student.
      try {
        setAnalysis(demoTeachBack(topic, text.trim()));
      } catch {
        setError('The AI analyzer is unavailable right now. Your progress is saved — please try again in a moment.');
        setPhase('write');
        return;
      }
    }
    setPhase('result');
  };

  const onFollowUpComplete = (attempts: Attempt[]) => {
    setFollowUpAttempts(attempts);
    setFollowUpDone(true);
  };

  // ------------------------------------------------------------ write phase
  if (phase === 'write') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="animate-fade-up card p-6 sm:p-8">
          <span className="pill mb-4">🧠 Teach-Back Challenge</span>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Explain {topic} in your own words
          </h1>
          <p className="mt-2 text-ink-soft">
            As if you were teaching it to someone who has never learned it before. The AI will analyze your{' '}
            <strong className="text-ink">understanding</strong> — not your writing style or grammar.
          </p>

          <label htmlFor="teachback-input" className="mt-6 mb-2 block text-sm font-semibold text-ink">
            Your explanation
          </label>
          <textarea
            id="teachback-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={`e.g. Explain ${topic} as if teaching a 10-year-old...`}
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:border-brand-500"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-ink-faint">
            <span>Minimum {minChars} characters</span>
            <span>{text.trim().length} / {minChars}</span>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-bad-line bg-bad-soft p-4 text-sm text-bad">
              {error}
              <button onClick={analyze} className="btn btn-ghost btn-md mt-3 w-full">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try Again
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={analyze}
              disabled={text.trim().length < minChars}
              className="btn btn-primary btn-lg flex-1"
            >
              Analyze My Explanation
              <Send className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
            <button onClick={onSkip} className="btn btn-ghost btn-lg">
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------- analyzing phase
  if (phase === 'analyzing') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-600" aria-hidden="true" />
        <h1 className="mt-6 font-display text-2xl font-extrabold text-ink">The AI is reading your explanation…</h1>
        <p className="mt-2 text-ink-soft">
          Checking which concepts came through clearly, which are shaky, and whether anything is misunderstood.
        </p>
      </div>
    );
  }

  // --------------------------------------------------------- result phase
  if (phase === 'result' && analysis) {
    const a = analysis;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="animate-fade-up card overflow-hidden">
          <div className="border-b border-line bg-gradient-to-r from-brand-50 to-accent-50 px-7 py-6 text-center">
            <span className="pill mb-2">🧠 Teach-Back Result</span>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Your Understanding</h1>
            <p className="mt-1 text-sm text-ink-soft">{topic}</p>
            <div className="mx-auto mt-4 w-fit rounded-xl bg-white px-5 py-3 shadow-sm ring-1 ring-line">
              <span className="font-display text-3xl font-extrabold text-brand-600">{a.overall_understanding}%</span>
              <span className="ml-1.5 text-sm font-medium text-ink-faint">conceptual understanding</span>
            </div>
          </div>

          <div className="p-7">
            {/* Categories */}
            {a.correctly_understood.length > 0 && (
              <section aria-label="Correctly understood" className="mb-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-good">
                  <span aria-hidden="true">🟢</span> Correctly understood
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {a.correctly_understood.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-ink-soft">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {a.partially_understood.length > 0 && (
              <section aria-label="Partially understood" className="mb-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-amber-600">
                  <span aria-hidden="true">🟡</span> Partially understood
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {a.partially_understood.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-ink-soft">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(a.misconceptions.length > 0 || a.missing_concepts.length > 0) && (
              <section aria-label="Misconceptions and missing concepts" className="mb-5">
                <h2 className="flex items-center gap-2 text-sm font-bold text-bad">
                  <span aria-hidden="true">🔴</span> Misconception detected
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {[...a.misconceptions, ...a.missing_concepts].map((c) => (
                    <li key={c} className="flex items-start gap-2 text-sm text-ink-soft">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Biggest learning gap */}
            <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5" aria-label="Biggest learning gap">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                <Target className="h-4.5 w-4.5 text-amber-500" aria-hidden="true" />
                🎯 Your Biggest Learning Gap
              </h2>
              <p className="mt-2 font-semibold text-ink">{a.biggest_learning_gap}</p>
              <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-amber-100">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                  Targeted re-explanation
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{a.targeted_explanation}</p>
              </div>
            </section>

            {/* Follow-up CTA */}
            {a.follow_up_questions.length > 0 ? (
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2 text-sm text-ink-soft">
                  <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Let's test the exact gap with {a.follow_up_questions.length} targeted question
                  {a.follow_up_questions.length > 1 ? 's' : ''}.
                </div>
                <button onClick={() => setPhase('quiz')} className="btn btn-primary btn-xl w-full">
                  Answer Targeted Questions
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button onClick={() => onDone(a)} className="btn btn-primary btn-xl mt-6 w-full">
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------- quiz phase
  if (phase === 'quiz' && analysis) {
    if (!followUpDone) {
      return (
        <div>
          <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
            <span className="pill border-brand-200 bg-brand-50 text-brand-700">
              🧠 Teach-Back · Targeted check
            </span>
            <p className="mt-2 text-sm text-ink-soft">
              Testing “{analysis.biggest_learning_gap}” — answerable from the targeted explanation above.
            </p>
          </div>
          <Quiz
            key="teachback-followup"
            questions={analysis.follow_up_questions}
            title="Teach-Back Follow-up"
            subtitle="These test your exact learning gap."
            onComplete={onFollowUpComplete}
          />
        </div>
      );
    }

    const correct = followUpAttempts.filter((x) => x.correct).length;
    const total = followUpAttempts.length || 1;
    const pct = Math.round((correct / total) * 100);
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="animate-fade-up card p-7 text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              pct >= 50 ? 'bg-good text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {pct >= 50 ? (
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="font-display text-xl font-extrabold">…</span>
            )}
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink">
            {pct >= 50 ? 'Gap addressed!' : 'Getting closer…'}
          </h1>
          <p className="mt-2 text-ink-soft">
            {pct >= 50
              ? `You answered ${correct} of ${total} targeted questions correctly — the gap is closing. This improves your retention estimate.`
              : `You answered ${correct} of ${total} targeted questions correctly. Re-read the targeted explanation and revisit this concept soon.`}
          </p>
          <button onClick={() => onDone(analysis)} className="btn btn-primary btn-xl mt-6 w-full">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}
