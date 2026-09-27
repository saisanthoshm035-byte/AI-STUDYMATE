import { Brain, CalendarClock, RefreshCw } from 'lucide-react';
import type { ConceptRetention, RetentionPoint, RetentionReport } from '../types';

interface RetentionPanelProps {
  report: RetentionReport;
  onStartReview: () => void;
}

const PRIORITY_STYLE: Record<ConceptRetention['review_priority'], { dot: string; text: string; label: string }> = {
  strong: { dot: 'bg-good', text: 'text-good', label: 'Strong' },
  'needs review': { dot: 'bg-amber-400', text: 'text-amber-600', label: 'Needs review' },
  high: { dot: 'bg-bad', text: 'text-bad', label: 'High priority' },
};

const TONE_BAR: Record<RetentionPoint['tone'], string> = {
  good: 'bg-good',
  warn: 'bg-amber-400',
  bad: 'bg-bad',
};

export default function RetentionPanel({ report, onStartReview }: RetentionPanelProps) {
  const max = Math.max(...report.curve.map((p) => p.percent), 1);

  return (
    <section className="animate-fade-up card mt-6 p-6 sm:p-7" aria-label="Knowledge retention">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Brain className="h-5 w-5 text-brand-600" aria-hidden="true" />
        🧠 Knowledge Retention
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        A prototype estimate of what you're likely to forget — and when to review it.
      </p>

      {/* Topic-level curve */}
      <div className="mt-5 space-y-2.5">
        {report.curve.map((p) => (
          <div key={p.days} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-semibold text-ink-soft">{p.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ${TONE_BAR[p.tone]}`}
                style={{ width: `${(p.percent / max) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-bold text-ink">
              {p.percent}%
              <span className="ml-1 font-medium text-ink-faint">
                {p.tone === 'good' ? '🟢' : p.tone === 'warn' ? '🟡' : '🔴'}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Concept-level risk */}
      {report.concepts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-ink">Retention Risk</h3>
          <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {report.concepts.slice(0, 6).map((c) => {
              const st = PRIORITY_STYLE[c.review_priority] ?? PRIORITY_STYLE['needs review'];
              return (
                <li
                  key={c.concept}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas/50 px-3.5 py-2.5"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={c.concept}>
                    {c.concept}
                  </span>
                  <span className={`shrink-0 text-xs font-bold ${st.text}`}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Recommendation + quick review */}
      {report.recommendedReview && (
        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-700">
            <CalendarClock className="h-4.5 w-4.5" aria-hidden="true" />
            🔄 Recommended Review
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{report.recommendationText}</p>
          <button onClick={onStartReview} className="btn btn-primary btn-lg mt-4 w-full sm:w-auto">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Start Quick Review
          </button>
        </div>
      )}
    </section>
  );
}
