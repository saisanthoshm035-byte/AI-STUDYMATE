import { useState } from 'react';
import {
  CheckCircle2, Download, FileText, Loader2, Lock, Printer, Target, TriangleAlert, CircleDot,
} from 'lucide-react';
import type { RplAssessment } from '../../rpl/types';
import { RPL_DISCLAIMER, RPL_READINESS_DISCLAIMER } from '../../rpl/types';
import { allCompetenciesAssessed, competencyPlan, competencyRun } from '../../rpl/skills-review';

/** Minimal dependency-free SVG radar chart for competency coverage. */
function Radar({ items }: { items: { label: string; value: number }[] }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = Math.max(3, items.length);
  const pt = (i: number, frac: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * r * frac, cy + Math.sin(ang) * r * frac];
  };
  const poly = (frac: number) => items.map((_, i) => pt(i, frac).join(',')).join(' ');
  const dataPoly = items.map((it, i) => pt(i, Math.max(0.04, it.value / 100)).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-xs" role="img" aria-label="Competency radar chart">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={poly(f)} fill="none" stroke="var(--color-line)" strokeWidth="1" />
      ))}
      {items.map((it, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.18);
        return (
          <g key={it.label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line)" strokeWidth="1" />
            <text x={lx} y={ly} textAnchor={lx > cx + 6 ? 'start' : lx < cx - 6 ? 'end' : 'middle'} dominantBaseline="middle" fontSize="8.5" fill="var(--color-ink-soft)">
              {it.label.length > 18 ? `${it.label.slice(0, 17)}…` : it.label}
            </text>
          </g>
        );
      })}
      <polygon points={dataPoly} fill="rgba(99,102,241,0.25)" stroke="#6366f1" strokeWidth="2" />
      {items.map((it, i) => {
        const [x, y] = pt(i, Math.max(0.04, it.value / 100));
        return <circle key={it.label} cx={x} cy={y} r="3" fill="#4f46e5" />;
      })}
    </svg>
  );
}

function BigBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="font-display text-lg font-extrabold text-ink">{value}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

interface Props {
  assessment: RplAssessment;
  reportLoading: boolean;
  onGenerateReport: () => void;
  onRestart: () => void;
  onDashboard: () => void;
  onBackToSkills: () => void;
}

export default function RplResults({ assessment, reportLoading, onGenerateReport, onRestart, onDashboard, onBackToSkills }: Props) {
  const [copied, setCopied] = useState(false);
  const gaps = assessment.gaps;
  const readiness = assessment.readiness;
  const report = assessment.report;
  const combined = assessment.combined;

  const radarItems = assessment.mappings.map((m) => ({
    label: m.competency,
    value: m.status === 'Demonstrated' ? 100 : m.status === 'Partially Demonstrated' ? 55 : m.status === 'Evidence Required' ? 25 : 8,
  }));

  const plan = competencyPlan(assessment);
  const allDone = allCompetenciesAssessed(assessment);
  const questionsTotal = plan.reduce((s, c) => s + competencyRun(assessment, c).totalQuestions, 0);
  const answered = Object.values(assessment.answers).filter((a) => a.text || a.chosen !== undefined).length;
  const hasRuns = plan.length > 0;

  const copyReport = async () => {
    if (!report) return;
    const text = [
      `RPL SKILL ASSESSMENT REPORT (AI-assisted preliminary assessment)`,
      `Candidate: ${assessment.profile.fullName} · Occupation: ${assessment.roleName} · Experience: ${assessment.profile.yearsExperience} years`,
      '',
      report.intro,
      ...report.sections.flatMap((s) => ['', s.heading, ...s.body]),
      '',
      'Recommended next steps:',
      ...report.nextSteps.map((s) => `- ${s}`),
      '',
      RPL_DISCLAIMER,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* ============ SKILL GAP ============ */}
      {gaps && (
        <section className="card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-extrabold text-ink">Your Skill Gap</h1>
          <p className="mt-1 text-sm text-ink-soft">Based on your experience, evidence and assessment answers for {assessment.roleName}.</p>

          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto]">
            <div className="space-y-5">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-good"><CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" /> Demonstrated skills</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {gaps.demonstrated.map((s) => (
                    <li key={s} className="rounded-lg border border-good-line bg-good-soft px-2.5 py-1 text-sm font-medium text-good">✓ {s}</li>
                  ))}
                  {gaps.demonstrated.length === 0 && <li className="text-sm text-ink-soft">None detected yet — more evidence or a re-run may help.</li>}
                </ul>
              </div>
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-amber-700"><CircleDot className="h-4.5 w-4.5" aria-hidden="true" /> Skills requiring more evidence</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {gaps.needsMoreEvidence.map((s) => (
                    <li key={s} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-700">• {s}</li>
                  ))}
                  {gaps.needsMoreEvidence.length === 0 && <li className="text-sm text-ink-soft">None — your evidence covers the framework.</li>}
                </ul>
              </div>
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-bad"><TriangleAlert className="h-4.5 w-4.5" aria-hidden="true" /> Potential learning gaps</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {gaps.learningGaps.map((s) => (
                    <li key={s} className="rounded-lg border border-bad-soft bg-bad-soft px-2.5 py-1 text-sm font-medium text-bad">• {s}</li>
                  ))}
                  {gaps.learningGaps.length === 0 && <li className="text-sm text-ink-soft">No learning gaps detected.</li>}
                </ul>
              </div>
            </div>
            <div className="self-center">
              <Radar items={radarItems} />
              <p className="mt-1 text-center text-[11px] text-ink-faint">Competency coverage — preliminary indicator</p>
            </div>
          </div>
        </section>
      )}

      {/* ============ READINESS ============ */}
      {readiness && (
        <section className="card mt-4 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-ink">RPL Readiness</h2>
              <p className="mt-1 text-sm text-ink-soft">How prepared you look for the formal RPL process.</p>
            </div>
            <div className="text-right">
              <div className="sf-shimmer font-display text-5xl font-extrabold">{readiness.overall}%</div>
              <div className="text-xs font-semibold text-ink-soft">Preliminary Readiness Indicator</div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <BigBar label="Experience Evidence" value={readiness.experienceEvidence} hint="Richness of your described prior learning" />
            <BigBar label="Competency Coverage" value={readiness.competencyCoverage} hint={`Share of the ${assessment.roleName} framework you demonstrate`} />
            <BigBar label="Assessment Performance" value={readiness.assessmentPerformance} hint={`${answered} of ${Math.max(questionsTotal, answered)} questions answered`} />
            <BigBar label="Evidence Completeness" value={readiness.evidenceCompleteness} hint={`${assessment.evidence.length} evidence item(s) recorded`} />
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs font-semibold text-amber-700">
            {RPL_READINESS_DISCLAIMER}
          </div>
        </section>
      )}

      {/* ============ COMBINED ANALYSIS (all competency assessments complete) ============ */}
      {combined && (
        <section className="card mt-4 p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-ink">
            <CheckCircle2 className="h-5 w-5 text-good" aria-hidden="true" />
            Combined Assessment Analysis
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            All {plan.length} skill assessments analyzed together.
            {combined.source === 'ai' ? ' Generated live by AI.' : ' Generated by the built-in assessment engine (AI unavailable).'}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{combined.summary}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-good-line bg-good-soft p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-good">Strengths</div>
              <ul className="mt-2 space-y-1 text-sm text-good">
                {combined.strengths.length ? combined.strengths.map((s) => <li key={s}>✓ {s}</li>) : <li>No clear strengths identified yet.</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Areas to improve</div>
              <ul className="mt-2 space-y-1 text-sm text-amber-700">
                {combined.improvements.length ? combined.improvements.map((s) => <li key={s}>• {s}</li>) : <li>Nothing significant flagged.</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ============ PER-COMPETENCY INDIVIDUAL RESULTS ============ */}
      {hasRuns && (
        <section className="card mt-4 p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold text-ink">Results by skill</h2>
          <p className="mt-1 text-xs text-ink-soft">Each skill's own assessment result — preliminary indicators only.</p>
          <ul className="mt-4 space-y-2.5">
            {plan.map((c) => {
              const run = competencyRun(assessment, c);
              return (
                <li key={c} className="rounded-xl border border-line bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{c}</span>
                    {run.state === 'assessed' ? (
                      <span className="pill border-good-line bg-good-soft text-[11px] text-good">
                        <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                        {run.scorePct}%
                      </span>
                    ) : run.state === 'in-progress' ? (
                      <span className="pill border-amber-200 bg-amber-50 text-[11px] text-amber-700">In progress · {run.answeredCount}/{run.totalQuestions}</span>
                    ) : (
                      <span className="pill text-[11px] text-ink-faint">Not started</span>
                    )}
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" role="presentation">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all" style={{ width: `${run.state === 'assessed' ? run.scorePct : 0}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {run.state === 'assessed'
                      ? `Completed — ${run.totalQuestions} question(s) answered.`
                      : run.state === 'in-progress'
                        ? 'Finish this assessment to include it in the combined report.'
                        : 'Take this assessment to include it in the combined report.'}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ============ REPORT ============ */}
      <section className="card mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-ink">
              <FileText className="h-5 w-5 text-brand-600" aria-hidden="true" />
              RPL Skill Assessment Report
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {report ? (report.source === 'ai' ? 'Generated live by AI.' : 'Generated by the built-in assessment engine (AI unavailable).') : allDone ? 'Generate your full preliminary report — it combines every skill assessment result.' : 'Complete every skill assessment to unlock your combined report.'}
            </p>
          </div>
          {report && (
            <div className="flex flex-wrap gap-2">
              <button onClick={copyReport} className="btn btn-ghost btn-md">{copied ? '✓ Copied' : 'Copy as text'}</button>
              <button onClick={() => window.print()} className="btn btn-primary btn-md">
                <Printer className="h-4 w-4" aria-hidden="true" />
                Download Report as PDF
              </button>
            </div>
          )}
        </div>

        {reportLoading && (
          <div className="mt-6 flex items-center gap-3 text-sm text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden="true" />
            Compiling your RPL report…
          </div>
        )}

        {/* Completion reminder — the combined report needs ALL skill assessments. */}
        {!report && !reportLoading && !allDone && hasRuns && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700">
                  Complete all skill assessments before generating your final report — {plan.filter((c) => competencyRun(assessment, c).state === 'assessed').length} of {plan.length} done.
                </p>
                <p className="mt-1 text-xs text-amber-700/90">
                  The report analyzes your combined results, so every skill needs its own completed assessment. You can go back and finish the remaining ones at any time.
                </p>
                <button onClick={onBackToSkills} className="btn btn-primary btn-md mt-3">
                  Continue assessments
                </button>
              </div>
            </div>
          </div>
        )}

        {!report && !reportLoading && allDone && (
          <button onClick={onGenerateReport} className="btn btn-primary btn-xl mt-6 w-full sm:w-auto">
            <Target className="h-5 w-5" aria-hidden="true" />
            Generate RPL Report
          </button>
        )}

        {report && (
          <article className="report-doc mt-6">
            <header className="rounded-xl border border-line bg-paper p-5">
              <h3 className="font-display text-lg font-extrabold text-ink">RPL Skill Assessment Report</h3>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline font-semibold text-ink">Candidate: </dt><dd className="inline text-ink-soft">{assessment.profile.fullName || '—'}</dd></div>
                <div><dt className="inline font-semibold text-ink">Target Occupation: </dt><dd className="inline text-ink-soft">{assessment.roleName}</dd></div>
                <div><dt className="inline font-semibold text-ink">Experience: </dt><dd className="inline text-ink-soft">{assessment.profile.yearsExperience || '—'} years</dd></div>
                <div><dt className="inline font-semibold text-ink">Date: </dt><dd className="inline text-ink-soft">{new Date(assessment.updatedAt).toLocaleDateString()}</dd></div>
              </dl>
            </header>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{report.intro}</p>
            {report.sections.map((s) => (
              <section key={s.heading} className="mt-5">
                <h3 className="font-display text-base font-bold text-ink">{s.heading}</h3>
                <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-ink-soft">
                  {s.body.map((b, i) => (
                    <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />{b}</li>
                  ))}
                </ul>
              </section>
            ))}
            <section className="mt-5">
              <h3 className="font-display text-base font-bold text-ink">Recommended Next Steps</h3>
              <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-ink-soft">
                {report.nextSteps.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />{s}</li>
                ))}
              </ul>
            </section>
            <footer className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs font-semibold text-amber-700">
              This report is an AI-assisted preliminary assessment and does not constitute an official RPL certificate.
            </footer>
          </article>
        )}

        {!report && !reportLoading && !hasRuns && !allDone && (
          <div className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Take your skill assessments first — then the combined report unlocks here.
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button onClick={onDashboard} className="btn btn-ghost btn-lg flex-1">Back to RPL Dashboard</button>
        {!allDone && hasRuns && (
          <button onClick={onBackToSkills} className="btn btn-ghost btn-lg flex-1">Back to assessments</button>
        )}
        <button onClick={onRestart} className="btn btn-primary btn-lg flex-1">Start New Assessment</button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-faint">
        <Download className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Use "Download Report as PDF" and choose "Save as PDF" in the print dialog.
      </p>
    </div>
  );
}
