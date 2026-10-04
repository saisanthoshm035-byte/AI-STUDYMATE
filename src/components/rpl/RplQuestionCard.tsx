import { useState } from 'react';
import { Brain, ChevronRight, Loader2, LogOut, Mic, MicOff, Send } from 'lucide-react';
import type { AnswerEvaluation, RplQuestion } from '../../rpl/types';
import { RPL_DISCLAIMER } from '../../rpl/types';
import { AiDisclaimer } from './SkillAnalysis';

interface Props {
  question: RplQuestion;
  index: number;
  total: number;
  evaluating: boolean;
  evaluation: AnswerEvaluation | null;
  onSubmit: (payload: { text?: string; chosen?: number }) => void;
  onNext: () => void;
  /** Self-paced: leave this competency's assessment now, progress saved. */
  onExit?: () => void;
}

/** Optional voice capture via the browser SpeechRecognition API (if available). */
function useDictation(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window));

  const toggle = () => {
    if (!supported) return;
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      setListening(false);
      (window as unknown as { __rplRec?: any }).__rplRec?.stop?.();
      return;
    }
    const rec = new Ctor();
    (window as unknown as { __rplRec?: any }).__rplRec = rec;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || 'en-IN';
    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
      onText(t.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };

  return { listening, supported, toggle };
}

const DIFF_TONE: Record<string, string> = {
  Beginner: 'border-good-line bg-good-soft text-good',
  Intermediate: 'border-amber-200 bg-amber-50 text-amber-700',
  Advanced: 'border-bad-soft bg-bad-soft text-bad',
};

export default function RplQuestionCard({ question, index, total, evaluating, evaluation, onSubmit, onNext, onExit }: Props) {
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<number | null>(null);
  const { listening, supported, toggle } = useDictation((t) => setText((prev) => (prev ? `${prev} ${t}` : t)));

  const isObjective = question.options.length === 4 && question.correctAnswer >= 0;
  const answered = isObjective ? chosen !== null : text.trim().length >= 3;
  const showEval = !!evaluation;

  const submit = () => {
    if (!answered) return;
    onSubmit(isObjective ? { chosen: chosen! } : { text: text.trim() });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between text-xs font-semibold text-ink-faint">
        <span>Question {index + 1} of {total}</span>
        <span className="flex items-center gap-1.5">
          <span className={`pill text-[11px] ${DIFF_TONE[question.difficulty] ?? ''}`}>{question.difficulty}</span>
          <span className="pill text-[11px]">{question.type}</span>
        </span>
      </div>
      {onExit && (
        <button onClick={onExit} className="btn btn-ghost btn-md mt-2 text-xs" title="Save progress and continue later">
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Save & continue later
        </button>
      )}

      <section className="card mt-3 p-6 sm:p-8" aria-label="Assessment question">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{question.competency}</p>
        <h1 className="mt-2 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">{question.prompt}</h1>

        {!showEval && isObjective && (
          <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Answer options">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setChosen(i)}
                role="radio"
                aria-checked={chosen === i}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition ${
                  chosen === i ? 'border-brand-200 bg-brand-50 font-semibold text-ink' : 'border-line bg-paper text-ink-soft hover:border-brand-200'
                }`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${chosen === i ? 'border-brand-600 bg-brand-600 text-white' : 'border-line text-ink-faint'}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        )}

        {!showEval && !isObjective && (
          <div className="mt-6">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Your answer</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="input mt-1 min-h-40 w-full"
                placeholder="Describe it in your own words — specific steps, tools and checks you used."
              />
            </label>
            {supported && (
              <button
                onClick={toggle}
                className={`btn btn-ghost btn-md mt-2 ${listening ? 'border-bad-soft text-bad' : ''}`}
                aria-pressed={listening}
              >
                {listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                {listening ? 'Stop voice input' : 'Answer by voice'}
              </button>
            )}
            <p className="mt-2 text-xs text-ink-faint">Answer in any language you're comfortable with — English, தமிழ், हिन्दी or your preferred language.</p>
          </div>
        )}

        {!showEval && (
          <button onClick={submit} disabled={!answered || evaluating} className="btn btn-primary btn-lg mt-6 w-full">
            {evaluating ? <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" /> : <Send className="h-4.5 w-4.5" aria-hidden="true" />}
            {evaluating ? 'AI evaluating…' : 'Submit Answer'}
          </button>
        )}

        {showEval && evaluation && (
          <div className="mt-6 space-y-4">
            {isObjective && (
              <div className={`rounded-xl border p-4 text-sm ${evaluation.correct ? 'border-good-line bg-good-soft text-good' : 'border-bad-soft bg-bad-soft text-bad'}`}>
                <strong>{evaluation.correct ? '✓ Correct.' : '✗ Not quite.'}</strong>
                {!evaluation.correct && ` The stronger answer: ${question.options[question.correctAnswer]}`}
              </div>
            )}
            {!isObjective && (
              <div className="rounded-xl border border-line bg-paper p-5">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <Brain className="h-4.5 w-4.5 text-brand-600" aria-hidden="true" />
                  AI Assessment Indicator — {evaluation.competency}
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Knowledge evidence', evaluation.knowledgeEvidence],
                    ['Practical reasoning', evaluation.practicalReasoning],
                    ['Safety awareness', evaluation.safetyAwareness],
                  ].map(([label, v]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-xs font-medium text-ink-soft">
                        <span>{label}</span>
                        <span className="font-display font-bold text-ink">{v}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500" style={{ width: `${v as number}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{evaluation.feedback}</p>
              </div>
            )}
            <AiDisclaimer text={RPL_DISCLAIMER} />
            <button onClick={onNext} className="btn btn-primary btn-lg w-full">
              {index + 1 >= total ? 'See My Skill Gaps' : 'Next Question'}
              <ChevronRight className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
