import { useState } from 'react';
import {
  BarChart3, CheckCircle2, ClipboardCheck, FileText, Search, ShieldCheck, Users, X,
} from 'lucide-react';
import type { RplAssessment } from '../../rpl/types';
import { RPL_DISCLAIMER } from '../../rpl/types';
import { deleteAssessment, loadAssessments, platformStats, saveAssessment } from '../../rpl/storage';
import { formatRelative } from '../../lib/storage';
import { MappingStatusChip } from './SkillAnalysis';

const DECISIONS = [
  { id: 'Accept Evidence', tone: 'btn-primary' },
  { id: 'Request More Evidence', tone: 'btn-ghost text-amber-700' },
  { id: 'Needs Practical Assessment', tone: 'btn-ghost text-brand-700' },
  { id: 'Manual Review', tone: 'btn-ghost text-ink-soft' },
];

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string | number; tone: string }) {
  return (
    <div className="card p-4">
      <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
      <div className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-ink-faint">{label}</div>
    </div>
  );
}

function MiniBars({ title, items, tone }: { title: string; items: { name: string; count: number }[]; tone: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.name}>
            <div className="flex justify-between text-xs text-ink-soft"><span>{i.name}</span><span className="font-semibold">{i.count}</span></div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${(i.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-ink-faint">No data yet.</li>}
      </ul>
    </div>
  );
}

function CandidateDetail({ a, onClose }: { a: RplAssessment; onClose: () => void }) {
  const [notes, setNotes] = useState(a.assessorReview?.notes ?? '');
  const [decision, setDecision] = useState<string | null>(a.assessorReview?.decision ?? null);
  const [saved, setSaved] = useState(false);

  const save = (d: string) => {
    saveAssessment({ ...a, assessorReview: { decision: d, notes, at: Date.now() } });
    setDecision(d);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button onClick={onClose} className="btn btn-ghost btn-md"><X className="h-4 w-4" aria-hidden="true" /> Back to console</button>

      <section className="card mt-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink">{a.profile.fullName || 'Unnamed candidate'}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {a.roleName} · {a.profile.yearsExperience || '?'} years experience · {a.profile.education || 'education not stated'} · {a.profile.location}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">Occupation: {a.profile.occupation || '—'} · Employment: {a.profile.employmentType || '—'} · Language: {a.profile.language} · Updated {formatRelative(a.updatedAt)}</p>
          </div>
          {a.readiness && <div className="text-right"><div className="font-display text-4xl font-extrabold text-brand-600">{a.readiness.overall}%</div><div className="text-[11px] text-ink-faint">AI readiness indicator</div></div>}
        </div>


        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold text-ink">Experience (candidate's words)</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-soft">
              <p>{a.experience.text || '—'}</p>
              {a.experience.jobs && <p><strong className="text-ink">Jobs:</strong> {a.experience.jobs}</p>}
              {a.experience.training && <p><strong className="text-ink">Training:</strong> {a.experience.training}</p>}
              {a.experience.tools && <p><strong className="text-ink">Tools:</strong> {a.experience.tools}</p>}
            </div>

            <h2 className="mt-5 text-sm font-bold text-ink">Evidence ({a.evidence.length})</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {a.evidence.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2">
                  <span className="truncate text-ink">{e.name} <span className="text-xs text-ink-faint">({e.kind})</span></span>
                  <span className="pill shrink-0 text-[11px]">{e.status}</span>
                </li>
              ))}
              {a.evidence.length === 0 && <li className="text-ink-soft">None submitted.</li>}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold text-ink">AI-extracted skills ({a.skills.length})</h2>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {a.skills.map((s) => (
                <li key={s.name} className={`pill text-[11px] ${s.confidence === 'High confidence' ? 'border-good-line bg-good-soft text-good' : s.confidence === 'Medium confidence' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-bad-soft bg-bad-soft text-bad'}`} title={s.source}>
                  {s.name} · {s.confidence}
                </li>
              ))}
            </ul>

            <h2 className="mt-5 text-sm font-bold text-ink">Competency mapping</h2>
            <table className="mt-2 w-full text-left text-xs" aria-label="Competency mapping">
              <thead><tr className="text-ink-faint"><th className="py-1 font-semibold">Competency</th><th className="py-1 font-semibold">Evidence</th><th className="py-1 font-semibold">Status</th></tr></thead>
              <tbody>
                {a.mappings.map((m) => (
                  <tr key={m.competency} className="border-t border-line/60">
                    <td className="py-1.5 pr-2 font-semibold text-ink">{m.competency}</td>
                    <td className="py-1.5 pr-2 text-ink-soft">{m.evidence}</td>
                    <td className="py-1.5"><MappingStatusChip s={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {a.gaps && (
              <>
                <h2 className="mt-5 text-sm font-bold text-ink">Skill gaps</h2>
                <p className="mt-1 text-xs text-ink-soft">
                  <span className="text-good">Demonstrated:</span> {a.gaps.demonstrated.join(', ') || '—'}
                  {' · '}<span className="text-amber-700">More evidence:</span> {a.gaps.needsMoreEvidence.join(', ') || '—'}
                  {' · '}<span className="text-bad">Gaps:</span> {a.gaps.learningGaps.join(', ') || '—'}
                </p>
              </>
            )}
          </div>
        </div>

        <h2 className="mt-6 text-sm font-bold text-ink">Assessment answers & AI analysis</h2>
        <ul className="mt-2 space-y-3">
          {a.questions.map((q) => {
            const ans = a.answers[q.id];
            const isObj = q.options.length === 4 && q.correctAnswer >= 0;
            return (
              <li key={q.id} className="rounded-xl border border-line bg-paper p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                  <span className="pill text-[11px]">{q.type}</span><span>{q.competency} · {q.difficulty}</span>
                </div>
                <p className="mt-1.5 font-semibold text-ink">{q.prompt}</p>
                <p className="mt-1.5 whitespace-pre-line text-ink-soft">
                  {isObj && ans?.chosen !== undefined
                    ? `Chose: ${q.options[ans.chosen]}${ans.evaluation?.correct ? ' ✓' : ' ✗'}`
                    : ans?.text || <span className="italic">Not answered</span>}
                </p>
                {ans?.evaluation && !ans.evaluation.autoScored && (
                  <p className="mt-1.5 text-xs text-ink-faint">
                    AI indicator — knowledge {ans.evaluation.knowledgeEvidence}%, reasoning {ans.evaluation.practicalReasoning}%, safety {ans.evaluation.safetyAwareness}%. {ans.evaluation.feedback}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {/* Assessor decision block */}
        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/40 p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <ClipboardCheck className="h-4.5 w-4.5 text-brand-600" aria-hidden="true" />
            Assessor Decision <span className="text-xs font-normal text-ink-faint">(human decision overrides AI)</span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <button key={d.id} onClick={() => setDecision(d.id)} className={`btn btn-md ${decision === d.id ? d.tone : 'btn-ghost'}`}>{d.id}</button>
            ))}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input mt-3 min-h-20 w-full" placeholder="Assessor notes (optional)…" />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => decision && save(decision)} disabled={!decision} className="btn btn-primary btn-md">Save Decision</button>
            {saved && <span className="flex items-center gap-1 text-sm font-semibold text-good"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Saved</span>}
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">{RPL_DISCLAIMER}</p>
      </section>
    </div>
  );
}

export default function AssessorConsole({ onExit }: { onExit?: () => void }) {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [all, setAll] = useState<RplAssessment[]>(() => loadAssessments());
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = platformStats();
  const open = all.find((a) => a.id === openId) ?? null;
  const filtered = all.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.profile.fullName || '').toLowerCase().includes(q) ||
      a.roleName.toLowerCase().includes(q) ||
      a.skills.some((s) => s.name.toLowerCase().includes(q))
    );
  });

  const refresh = () => setAll(loadAssessments());

  if (view === 'detail' && open) {
    return <CandidateDetail a={open} onClose={() => { setOpenId(null); setView('list'); refresh(); }} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {onExit && (
        <button onClick={onExit} className="btn btn-ghost btn-md mb-4">← Back to RPL Dashboard</button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="pill border-good-line bg-good-soft text-good"><ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden="true" /> Human review layer</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-ink">Assessor Console</h1>
          <p className="mt-1 text-sm text-ink-soft">AI assists — the assessor decides. Every AI result here can be overridden.</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="input w-64 pl-9" placeholder="Search candidates, roles, skills…" aria-label="Search assessments" />
        </div>
      </div>

      {/* Admin stats */}
      <h2 className="mt-8 flex items-center gap-2 font-display text-lg font-bold text-ink"><BarChart3 className="h-5 w-5 text-brand-600" aria-hidden="true" /> Platform overview</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total candidates" value={stats.totalCandidates} tone="text-brand-600" />
        <StatCard icon={FileText} label="Assessments started" value={stats.started} tone="text-accent-600" />
        <StatCard icon={CheckCircle2} label="Assessments completed" value={stats.completed} tone="text-emerald-600" />
        <StatCard icon={ClipboardCheck} label="Need human review" value={stats.needsHumanReview} tone="text-amber-600" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MiniBars title="Most selected occupations" items={stats.topRoles} tone="bg-brand-500" />
        <MiniBars title="Common skill gaps" items={stats.commonGaps} tone="bg-rose-500" />
        <div className="card p-5">
          <h3 className="text-sm font-bold text-ink">Evidence uploaded</h3>
          <div className="mt-3 font-display text-3xl font-extrabold text-ink">{stats.evidenceCount}</div>
          <p className="mt-1 text-xs text-ink-faint">Files stay on-device; only names and statuses are recorded.</p>
        </div>
      </div>

      {/* Candidate list */}
      <h2 className="mt-8 font-display text-lg font-bold text-ink">Candidates</h2>
      <ul className="mt-3 space-y-2.5">
        {filtered.map((a) => (
          <li key={a.id} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{a.profile.fullName || 'Unnamed'}</span>
                <span className="pill text-[11px]">{a.roleName}</span>
                {a.mappings.some((m) => m.status === 'Evidence Required' || m.status === 'Not Yet Demonstrated') && (
                  <span className="pill border-amber-200 bg-amber-50 text-[11px] text-amber-700">Flagged for review</span>
                )}
                {a.assessorReview && <span className="pill border-good-line bg-good-soft text-[11px] text-good">Reviewed: {a.assessorReview.decision}</span>}
              </div>
              <div className="mt-0.5 text-xs text-ink-faint">
                {a.skills.length} skills · {a.evidence.length} evidence · {Object.keys(a.answers).length} answers · {formatRelative(a.updatedAt)}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => { setOpenId(a.id); setView('detail'); }} className="btn btn-primary btn-md">Review</button>
              <button onClick={() => { deleteAssessment(a.id); refresh(); }} className="btn btn-ghost btn-md text-bad" aria-label="Delete">✕</button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-ink-soft">No assessments found. Candidates appear here after they complete the skill analysis step.</li>}
      </ul>
    </div>
  );
}
