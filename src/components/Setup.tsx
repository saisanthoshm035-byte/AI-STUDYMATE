import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Clock, GraduationCap, Target } from 'lucide-react';
import type { Goal, Level } from '../types';

interface SetupProps {
  initialTopic: string;
  onGenerate: (input: { topic: string; level: Level; goal: Goal; time: string }) => void;
  onBack: () => void;
}

const LEVELS: { value: Level; hint: string }[] = [
  { value: 'Beginner', hint: 'Plain language, foundations first' },
  { value: 'Intermediate', hint: 'Practical depth and connections' },
  { value: 'Advanced', hint: 'Technical detail and edge cases' },
];

const GOALS: { value: Goal; hint: string }[] = [
  { value: 'Understand the basics', hint: 'Get the core ideas' },
  { value: 'Prepare for an exam', hint: 'Exam-style depth' },
  { value: 'Revise quickly', hint: 'Fast refresher' },
  { value: 'Master the concept', hint: 'Deep understanding' },
];

const TIMES = ['5', '10', '15'];

export default function Setup({ initialTopic, onGenerate, onBack }: SetupProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [level, setLevel] = useState<Level>('Beginner');
  const [goal, setGoal] = useState<Goal>('Understand the basics');
  const [time, setTime] = useState('10');
  const [touched, setTouched] = useState(false);

  const topicError = touched && topic.trim().length < 2 ? 'Please enter a topic — at least 2 characters.' : '';
  const valid = topic.trim().length >= 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid) onGenerate({ topic: topic.trim(), level, goal, time });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <button onClick={onBack} className="mb-6 text-sm font-medium text-ink-soft transition hover:text-brand-700">
        ← Back
      </button>

      <div className="animate-fade-up card p-6 sm:p-9">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          What are we learning today?
        </h1>
        <p className="mt-2 text-ink-soft">
          Your AI tutor builds the lesson, tests you, and adapts when something doesn't stick.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-7" noValidate>
          {/* Topic */}
          <div>
            <label htmlFor="topic" className="mb-2 block text-sm font-semibold text-ink">
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="What do you want to learn?"
              aria-invalid={!!topicError}
              aria-describedby={topicError ? 'topic-error' : undefined}
              className={`w-full rounded-xl border bg-white px-4 py-3.5 text-base text-ink placeholder:text-ink-faint transition focus:outline-none ${
                topicError ? 'border-bad' : 'border-line focus:border-brand-500'
              }`}
              autoFocus
            />
            {topicError && (
              <p id="topic-error" role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-bad">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {topicError}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {['Photosynthesis', "Newton's Laws", 'Binary Search'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTopic(s)}
                  className="rounded-full border border-line bg-canvas px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Level */}
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <GraduationCap className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Your level
            </legend>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLevel(l.value)}
                  aria-pressed={level === l.value}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    level === l.value
                      ? 'border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-600'
                      : 'border-line bg-white hover:border-brand-300'
                  }`}
                >
                  <div className={`text-sm font-bold ${level === l.value ? 'text-brand-700' : 'text-ink'}`}>{l.value}</div>
                  <div className="mt-0.5 text-xs text-ink-faint">{l.hint}</div>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Goal */}
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Target className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Learning goal
            </legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGoal(g.value)}
                  aria-pressed={goal === g.value}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    goal === g.value
                      ? 'border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-600'
                      : 'border-line bg-white hover:border-brand-300'
                  }`}
                >
                  <div className={`text-sm font-bold ${goal === g.value ? 'text-brand-700' : 'text-ink'}`}>{g.value}</div>
                  <div className="mt-0.5 text-xs text-ink-faint">{g.hint}</div>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Time */}
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" />
              How much time do you have? <span className="font-normal text-ink-faint">(optional)</span>
            </legend>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Time budget">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  aria-pressed={time === t}
                  className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                    time === t ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-soft hover:border-brand-300'
                  }`}
                >
                  {t} minutes
                </button>
              ))}
            </div>
          </fieldset>

          <button type="submit" disabled={!valid} className="btn btn-primary btn-xl w-full">
            Generate My Lesson
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
