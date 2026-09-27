import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { ProgressBar } from './ui';
import { CONFIDENCE_OPTIONS, classifyConfidence, confidenceStateLabel, isHighConfidence } from '../lib/confidence';
import type { Attempt, ConfidenceLevel, QuizQuestion } from '../types';

interface QuizProps {
  questions: QuizQuestion[];
  title: string;
  subtitle: string;
  onComplete: (attempts: Attempt[]) => void;
  /** Optional intelligence-layer extension: collect confidence per question. */
  collectConfidence?: boolean;
}

export default function Quiz({ questions, title, subtitle, onComplete, collectConfidence = false }: QuizProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);

  const q = questions[index];
  const isLast = index === questions.length - 1;

  if (!q) return null;

  const choose = (i: number) => {
    if (submitted) return;
    setSelected(i);
  };

  const submit = () => {
    if (selected === null) return;
    setSubmitted(true);
    setAttempts((a) => [
      ...a,
      { question: q, chosen: selected, correct: selected === q.correctAnswer, confidence },
    ]);
  };

  const next = () => {
    if (isLast) {
      onComplete(attempts);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
    setConfidence(null);
  };

  const wasCorrect = attempts.find((a) => a.question === q)?.correct ?? false;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <span className="pill">{title}</span>
          <span className="text-sm font-semibold text-ink-soft">
            Question {index + 1} of {questions.length}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-faint">{subtitle}</p>
        <div className="mt-3">
          <ProgressBar value={((index + (submitted ? 1 : 0)) / questions.length) * 100} />
        </div>
      </div>

      {/* Question card */}
      <div key={index} className="animate-fade-up card p-6 sm:p-8">
        <h1 className="font-display text-xl font-bold leading-snug text-ink">{q.question}</h1>

        {/* Optional confidence selector (intelligence layer — never blocks the quiz) */}
        {collectConfidence && !submitted && (
          <fieldset className="mt-4 rounded-xl border border-line bg-canvas/50 px-4 py-3">
            <legend className="px-1 text-xs font-bold text-ink-soft">How confident are you?</legend>
            <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Confidence level">
              {CONFIDENCE_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={confidence === c.value}
                  onClick={() => setConfidence(confidence === c.value ? null : c.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    confidence === c.value
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line bg-white text-ink-soft hover:border-brand-300'
                  }`}
                >
                  <span aria-hidden="true">{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Options */}
        <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Answer options">
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === q.correctAnswer;
            let state = 'idle';
            if (submitted) {
              if (isCorrect) state = 'correct';
              else if (isSelected) state = 'wrong';
              else state = 'dim';
            }
            return (
              <button
                key={i}
                role="radio"
                aria-checked={isSelected}
                disabled={submitted}
                onClick={() => choose(i)}
                className={`flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left text-sm transition ${
                  state === 'idle'
                    ? isSelected
                      ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                      : 'border-line bg-white hover:border-brand-300 hover:bg-brand-50/40'
                    : state === 'correct'
                      ? 'border-good-line bg-good-soft'
                      : state === 'wrong'
                        ? 'border-bad-line bg-bad-soft'
                        : 'border-line bg-white opacity-55'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-display text-xs font-extrabold ${
                    state === 'correct'
                      ? 'border-good-line bg-good text-white'
                      : state === 'wrong'
                        ? 'border-bad-line bg-bad text-white'
                        : isSelected
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-line bg-canvas text-ink-soft'
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className={`flex-1 ${state === 'dim' ? 'text-ink-faint' : 'text-ink'}`}>{opt}</span>
                {state === 'correct' && <CheckCircle2 className="h-5 w-5 shrink-0 text-good" aria-label="Correct answer" />}
                {state === 'wrong' && <XCircle className="h-5 w-5 shrink-0 text-bad" aria-label="Your wrong answer" />}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {submitted && (
          <div
            role="status"
            className={`animate-fade-up mt-6 rounded-xl border p-5 ${
              wasCorrect ? 'border-good-line bg-good-soft' : 'border-bad-line bg-bad-soft'
            }`}
          >
            <div className={`flex items-center gap-2 font-display font-bold ${wasCorrect ? 'text-good' : 'text-bad'}`}>
              {wasCorrect ? (
                <>
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Correct!
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5" aria-hidden="true" /> Not quite — let's understand why.
                </>
              )}
            </div>
            <p className={`mt-2 text-sm leading-relaxed ${wasCorrect ? 'text-emerald-900' : 'text-red-900'}`}>
              {q.explanation}
            </p>
            {/* Confidence-gap alert (only when confidence was provided) */}
            {collectConfidence && !wasCorrect && isHighConfidence(confidence) && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                <div>
                  <div className="text-sm font-bold text-amber-700">🚨 Confidence Gap Detected</div>
                  <p className="mt-0.5 text-sm text-amber-800/90">
                    You were highly confident in this answer, but the answer appears to be incorrect. Let's review
                    this concept ({q.concept}) before moving on.
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-700/80">
                    Classification: {confidenceStateLabel(classifyConfidence(false, confidence))}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-7 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-ink-faint">
            Concept: <span className="text-ink-soft">{q.concept}</span>
          </span>
          {!submitted ? (
            <button onClick={submit} disabled={selected === null} className="btn btn-primary btn-lg">
              Submit Answer
            </button>
          ) : (
            <button onClick={next} className="btn btn-primary btn-lg">
              {isLast ? 'See Results' : 'Continue'}
              <ChevronRight className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
