import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Lightbulb,
  Globe2,
  Pause,
  Volume2,
} from 'lucide-react';
import { buildLessonSpeech, speak, speechSupported, stopSpeaking } from '../lib/speech';
import type { Lesson } from '../types';

interface LessonProps {
  lesson: Lesson;
  onStartQuiz: () => void;
  onRegenerate: () => void;
  /** Optional intelligence-layer extension: teach the concept back to the AI. */
  onTeachBack?: () => void;
}

export default function LessonView({ lesson, onStartQuiz, onRegenerate, onTeachBack }: LessonProps) {
  const [speaking, setSpeaking] = useState(false);

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speak(buildLessonSpeech(lesson.topic, lesson.summary, lesson.keyConcepts));
      setSpeaking(true);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="animate-fade-up mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill"><BookOpen className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> Lesson</span>
          <span className="pill">{lesson.level}</span>
          {lesson.goal && <span className="pill">{lesson.goal}</span>}
          {lesson.source === 'demo' && <span className="pill">Demo Engine</span>}
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{lesson.topic}</h1>
        {speechSupported() && (
          <button
            onClick={toggleSpeak}
            className="btn btn-ghost btn-md mt-4"
            aria-pressed={speaking}
            title="Read the lesson aloud (uses your browser's text-to-speech)"
          >
            {speaking ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            {speaking ? 'Stop reading' : 'Read aloud'}
          </button>
        )}
      </div>

      {/* Summary */}
      <section className="animate-fade-up card p-6 sm:p-7" style={{ animationDelay: '0.05s' }}>
        <h2 className="font-display text-lg font-bold text-ink">Quick summary</h2>
        <p className="mt-2 leading-relaxed text-ink-soft">{lesson.summary}</p>
      </section>

      {/* Key concepts */}
      <section className="mt-6" aria-label="Key concepts">
        <h2 className="animate-fade-up font-display text-lg font-bold text-ink">Key concepts</h2>
        <div className="mt-3 space-y-3">
          {lesson.keyConcepts.map((c, i) => (
            <article key={c.title} className="card animate-fade-up p-5 sm:p-6" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-display text-sm font-extrabold text-brand-700">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-display font-bold text-ink">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{c.explanation}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Real world + analogy */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {lesson.realWorldExample && (
          <section className="card animate-fade-up border-accent-100 bg-accent-50/40 p-6" aria-label="Real-world connection">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <Globe2 className="h-4.5 w-4.5 text-accent-600" aria-hidden="true" />
              Real-world connection
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{lesson.realWorldExample}</p>
          </section>
        )}
        {lesson.analogy && (
          <section className="card animate-fade-up border-amber-100 bg-amber-50/40 p-6" aria-label="Simple analogy">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <Lightbulb className="h-4.5 w-4.5 text-amber-500" aria-hidden="true" />
              Simple analogy
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{lesson.analogy}</p>
          </section>
        )}
      </div>

      {/* Common mistakes */}
      {lesson.commonMistakes.length > 0 && (
        <section className="card animate-fade-up mt-4 border-bad-soft bg-bad-soft/40 p-6" aria-label="Common mistakes">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <AlertTriangle className="h-4.5 w-4.5 text-bad" aria-hidden="true" />
            Common mistakes
          </h2>
          <ul className="mt-3 space-y-2.5">
            {lesson.commonMistakes.map((m) => (
              <li key={m} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad/60" aria-hidden="true" />
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CTA */}
      <div className="animate-fade-up mt-10 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-accent-50 p-7 text-center">
        <h2 className="font-display text-xl font-extrabold text-ink">Ready to test your understanding?</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          {lesson.quiz.length} concept-based questions · the AI adapts to whatever you miss
        </p>
        <button onClick={onStartQuiz} className="btn btn-primary btn-xl mt-5">
          Start Quiz
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
        {onTeachBack && (
          <div className="mt-3">
            <button onClick={onTeachBack} className="btn btn-ghost btn-lg">
              <Brain className="h-4.5 w-4.5" aria-hidden="true" />
              🧠 Teach It Back
            </button>
          </div>
        )}
        <div className="mt-4">
          <button onClick={onRegenerate} className="text-sm font-medium text-ink-faint transition hover:text-brand-700">
            Regenerate lesson
          </button>
        </div>
      </div>
    </div>
  );
}
