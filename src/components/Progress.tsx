import { ArrowRight, BookOpen, CheckCircle2, Clock, Flame, TrendingUp, Trash2, Zap } from 'lucide-react';
import { clearHistory, formatRelative, loadXp } from '../lib/storage';
import type { LearningSession } from '../types';

interface ProgressProps {
  sessions: LearningSession[];
  onChange: () => void;
  onStart: () => void;
}

export default function Progress({ sessions, onChange, onStart }: ProgressProps) {
  const xp = loadXp();
  const avgInitial = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + x.initialScore, 0) / sessions.length)
    : 0;
  const totalImproved = sessions.reduce((s, x) => s + x.improvedConcepts.length, 0);
  const totalMinutes = sessions.reduce((s, x) => s + x.durationMinutes, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="animate-fade-up font-display text-3xl font-extrabold tracking-tight text-ink">My Progress</h1>
      <p className="animate-fade-up mt-1.5 text-ink-soft">Your learning history, stored privately on this device.</p>

      {sessions.length === 0 ? (
        <div className="animate-fade-up card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
            <BookOpen className="h-7 w-7 text-brand-600" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-display text-xl font-extrabold text-ink">Your learning journey starts here</h2>
          <p className="mt-2 max-w-sm text-ink-soft">
            Complete your first adaptive lesson and AI StudyMate will track your scores, improvements and study time here.
          </p>
          <button onClick={onStart} className="btn btn-primary btn-xl mt-7">
            Start Your First Lesson
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <div className="animate-fade-up mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <Zap className="mx-auto h-4.5 w-4.5 text-amber-500" aria-hidden="true" />
              <div className="mt-1.5 font-display text-2xl font-extrabold text-ink">{xp}</div>
              <div className="text-xs text-ink-faint">Total XP</div>
            </div>
            <div className="card p-4 text-center">
              <TrendingUp className="mx-auto h-4.5 w-4.5 text-good" aria-hidden="true" />
              <div className="mt-1.5 font-display text-2xl font-extrabold text-ink">{avgInitial}%</div>
              <div className="text-xs text-ink-faint">Avg initial score</div>
            </div>
            <div className="card p-4 text-center">
              <CheckCircle2 className="mx-auto h-4.5 w-4.5 text-brand-600" aria-hidden="true" />
              <div className="mt-1.5 font-display text-2xl font-extrabold text-ink">{totalImproved}</div>
              <div className="text-xs text-ink-faint">Concepts improved</div>
            </div>
            <div className="card p-4 text-center">
              <Clock className="mx-auto h-4.5 w-4.5 text-accent-600" aria-hidden="true" />
              <div className="mt-1.5 font-display text-2xl font-extrabold text-ink">{totalMinutes}m</div>
              <div className="text-xs text-ink-faint">Learning time</div>
            </div>
          </div>

          <h2 className="mt-9 font-display text-lg font-bold text-ink">Recent topics</h2>
          <div className="mt-3 space-y-2.5">
            {sessions.map((s) => (
              <div key={s.id} className="card flex items-center gap-4 p-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-extrabold ${
                    s.initialScore >= 80
                      ? 'bg-good-soft text-good'
                      : s.initialScore >= 50
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-bad-soft text-bad'
                  }`}
                >
                  {s.initialScore}%
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-ink">{s.topic}</span>
                    <span className="pill py-0.5 text-[10px]">{s.level}</span>
                    {s.retryScore !== null && s.retryScore > s.initialScore && (
                      <span className="pill border-good-line bg-good-soft py-0.5 text-[10px] text-good">
                        <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        +{s.retryScore - s.initialScore} pts after adapt
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {formatRelative(s.createdAt)} · {s.totalQuestions} questions · {s.durationMinutes} min ·{' '}
                    {s.improvedConcepts.length > 0 ? `${s.improvedConcepts.length} concept(s) improved` : 'no weak concepts'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button onClick={onStart} className="btn btn-primary btn-lg">
              <Flame className="h-4 w-4" aria-hidden="true" />
              New Session
            </button>
            <button
              onClick={() => {
                if (window.confirm('Clear all learning history on this device?')) {
                  clearHistory();
                  onChange();
                }
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-ink-faint transition hover:text-bad"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear history
            </button>
          </div>
        </>
      )}
    </div>
  );
}
