import { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, Loader2 } from 'lucide-react';

interface GeneratingProps {
  topic: string;
  level: string;
}

const STAGES = [
  'Understanding your topic…',
  'Adapting the lesson to your level…',
  'Finding the best analogy…',
  'Creating your quiz…',
  'Preparing your learning path…',
];

export default function Generating({ topic, level }: GeneratingProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-100 opacity-60" aria-hidden="true" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-lift">
          <BrainCircuit className="h-9 w-9" aria-hidden="true" />
        </div>
      </div>

      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        AI StudyMate is preparing your lesson…
      </h1>
      <p className="mt-3 text-ink-soft">
        <span className="font-semibold text-ink">{topic}</span> · {level}
      </p>

      <ul className="mt-9 w-full space-y-2.5 text-left" aria-live="polite">
        {STAGES.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-500 ${
              i < stage
                ? 'border-good-line bg-good-soft text-good'
                : i === stage
                  ? 'border-brand-200 bg-brand-50 font-semibold text-brand-700'
                  : 'border-line bg-white text-ink-faint'
            }`}
          >
            {i < stage ? (
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            ) : i === stage ? (
              <Loader2 className="h-4.5 w-4.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <span className="ml-4.5 mr-4.5 block h-4.5 w-4.5 shrink-0 rounded-full border-2 border-dashed border-line" aria-hidden="true" />
            )}
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
