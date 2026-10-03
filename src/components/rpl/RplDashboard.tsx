import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BarChart3, BookOpenCheck, Bot, FileSearch, FileText, LayoutGrid, Loader2,
  PlayCircle, Radar as RadarIcon, Send, ShieldCheck, Sparkles, Trash2, UploadCloud, X,
} from 'lucide-react';
import type { RplAssessment } from '../../rpl/types';
import { RPL_DISCLAIMER } from '../../rpl/types';
import { rplApi } from '../../rpl/api';
import { loadAssessments } from '../../rpl/storage';
import { formatRelative } from '../../lib/storage';

const CARDS = [
  { id: 'new', icon: PlayCircle, title: 'Start New Assessment', desc: 'Guided 6-step flow: profile → role → experience → evidence → AI analysis → assessment.', tone: 'text-brand-600' },
  { id: 'my', icon: LayoutGrid, title: 'My Assessments', desc: 'Continue drafts or review completed assessments.', tone: 'text-accent-600' },
  { id: 'profile', icon: BookOpenCheck, title: 'Skill Profile', desc: 'Skills AI detected across your assessments, with confidence levels.', tone: 'text-emerald-600' },
  { id: 'evidence', icon: UploadCloud, title: 'Evidence Portfolio', desc: 'Everything you recorded, with verification statuses.', tone: 'text-amber-600' },
  { id: 'gap', icon: RadarIcon, title: 'Skill Gap Analysis', desc: 'Demonstrated skills vs. gaps across your best assessment.', tone: 'text-rose-600' },
  { id: 'report', icon: FileText, title: 'RPL Readiness Report', desc: 'Your latest readiness indicator and downloadable report.', tone: 'text-violet-600' },
];

const PIPELINE = ['Profile', 'Evidence', 'Skill Mapping', 'Assessment', 'Skill Gap', 'Report'];

function PipelineStrip() {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-semibold">
        <span className="text-ink-faint">YOUR PATH:</span>
        {PIPELINE.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-0.5 text-brand-700">{i + 1}. {s}</span>
            {i < PIPELINE.length - 1 && <span className="text-ink-faint">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: RplAssessment['status'] }) {
  const map: Record<string, { t: string; c: string }> = {
    draft: { t: 'Draft', c: 'text-ink-faint' },
    analyzed: { t: 'Skills analyzed', c: 'border-amber-200 bg-amber-50 text-amber-700' },
    assessed: { t: 'Assessed', c: 'border-brand-200 bg-brand-50 text-brand-700' },
    complete: { t: 'Complete', c: 'border-good-line bg-good-soft text-good' },
  };
  const v = map[s] ?? map.draft;
  return <span className={`pill text-[11px] ${v.c}`}>{v.t}</span>;
}

/** Chat panel for the RPL Assistant (section 15). */
function AssistantChat({ assessment }: { assessment: RplAssessment | null }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    {
      role: 'ai',
      text: "Hi! I'm the RPL Assistant. Ask me things like:\n• What is RPL?\n• What evidence can I submit?\n• What are my identified skill gaps?\n• How can I prepare for assessment?",
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const ask = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const gaps = assessment ? [...(assessment.gaps?.needsMoreEvidence ?? []), ...(assessment.gaps?.learningGaps ?? [])] : [];
      const topSkills = assessment ? assessment.skills.filter((s) => s.confidence === 'High confidence').slice(0, 5).map((s) => s.name) : [];
      const res = await rplApi.askAssistant({
        question: q,
        context: assessment
          ? {
              role: assessment.roleName,
              yearsExperience: assessment.profile.yearsExperience,
              topSkills,
              gaps,
              readiness: assessment.readiness?.overall,
            }
          : {},
      });
      setMessages((m) => [...m, { role: 'ai', text: res.answer }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: "I couldn't reach the AI service just now. Your assessment data is safe — please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex h-[26rem] flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="sf-logo-tile flex h-7 w-7 items-center justify-center rounded-lg text-white"><Bot className="h-4 w-4" aria-hidden="true" /></span>
        <div className="flex-1">
          <div className="text-sm font-bold text-ink">RPL Assistant</div>
          <div className="text-[11px] text-ink-faint">Knows your assessment context · AI-assisted only</div>
        </div>
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 leading-relaxed ${m.role === 'user' ? 'bg-brand-600 text-left text-white' : 'border border-line bg-paper text-ink-soft'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-ink-faint"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Thinking…</div>
        )}
      </div>
      <div className="border-t border-line p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void ask(); } }}
            className="input flex-1"
            placeholder="Ask about RPL, evidence, your gaps…"
            aria-label="Message the RPL Assistant"
          />
          <button onClick={() => void ask()} disabled={busy || !input.trim()} className="btn btn-primary btn-md shrink-0" aria-label="Send">
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  onStartNew: () => void;
  onOpenAssessment: (id: string) => void;
  onDeleteAssessment: (id: string) => void;
  onOpenAssessor: () => void;
}

export default function RplDashboard({ onStartNew, onOpenAssessment, onDeleteAssessment, onOpenAssessor }: Props) {
  const [section, setSection] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<RplAssessment[]>([]);
  const best = assessments.find((a) => a.readiness) ?? assessments[0] ?? null;

  useEffect(() => setAssessments(loadAssessments()), [section]);

  const handleCard = (id: string) => {
    if (id === 'new') return onStartNew();
    if (id === 'my') return setSection('my');
    if (id === 'profile') return setSection('profile');
    if (id === 'evidence') return setSection('evidence');
    if (id === 'gap') return setSection('gap');
    if (id === 'report') return setSection('report');
  };

  const openBest = () => best && onOpenAssessment(best.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="pill border-brand-200 bg-brand-50 text-brand-700">
            <Sparkles className="mr-1 inline h-3 w-3" aria-hidden="true" />
            RPL Skill Assessment
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">RPL Assessment</h1>
          <p className="mt-1 text-ink-soft">Discover and validate the skills you already have.</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-faint">
            AI-assisted assessment of skills gained through work experience, informal learning, training and prior education.
          </p>
        </div>
        <button onClick={() => onStartNew()} className="btn btn-primary btn-lg">
          <PlayCircle className="h-5 w-5" aria-hidden="true" />
          Start RPL Assessment
        </button>
      </div>

      <div className="mt-6">
        <PipelineStrip />
      </div>

      {/* cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <button key={c.id} onClick={() => handleCard(c.id)} className="card group p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-200">
            <c.icon className={`h-7 w-7 ${c.tone}`} aria-hidden="true" />
            <div className="mt-3 font-display text-base font-bold text-ink">{c.title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{c.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
              Open <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>

      {/* ================== SECTIONS ================== */}
      {section === 'my' && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><LayoutGrid className="h-5 w-5 text-accent-600" aria-hidden="true" /> My Assessments</h2>
            <button onClick={() => setSection(null)} className="btn btn-ghost h-9 w-9 p-0" aria-label="Close"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <ul className="mt-4 space-y-2.5">
            {assessments.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{a.roleName || 'Untitled role'}</span>
                    <StatusPill s={a.status} />
                    {a.readiness && <span className="pill border-good-line bg-good-soft text-[11px] text-good">{a.readiness.overall}% ready</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    {a.profile.fullName || 'Unnamed'} · {a.evidence.length} evidence · updated {formatRelative(a.updatedAt)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => onOpenAssessment(a.id)} className="btn btn-ghost btn-md">Open</button>
                  <button onClick={() => { onDeleteAssessment(a.id); setAssessments(loadAssessments()); }} className="btn btn-ghost btn-md text-bad" aria-label={`Delete ${a.roleName} assessment`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
            {assessments.length === 0 && <li className="text-sm text-ink-soft">No assessments yet. Start your first one.</li>}
          </ul>
        </section>
      )}

      {section === 'profile' && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><BookOpenCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Skill Profile</h2>
            <button onClick={() => setSection(null)} className="btn btn-ghost h-9 w-9 p-0" aria-label="Close"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {[...new Map(assessments.flatMap((a) => a.skills).map((s) => [s.name.toLowerCase(), s])).values()].map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper p-3.5 text-sm">
                <div>
                  <div className="font-semibold text-ink">{s.name}</div>
                  <div className="text-xs text-ink-faint">{s.source}</div>
                </div>
                <span className={`pill text-[11px] ${s.confidence === 'High confidence' ? 'border-good-line bg-good-soft text-good' : s.confidence === 'Medium confidence' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-bad-soft bg-bad-soft text-bad'}`}>{s.confidence}</span>
              </li>
            ))}
            {[...new Map(assessments.flatMap((a) => a.skills).map((s) => [s.name.toLowerCase(), s])).values()].length === 0 && (
              <li className="text-sm text-ink-soft">Run a skill analysis to populate your profile.</li>
            )}
          </ul>
        </section>
      )}

      {section === 'evidence' && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><UploadCloud className="h-5 w-5 text-amber-600" aria-hidden="true" /> Evidence Portfolio</h2>
            <button onClick={() => setSection(null)} className="btn btn-ghost h-9 w-9 p-0" aria-label="Close"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <ul className="mt-4 space-y-2.5">
            {assessments.flatMap((a) => a.evidence.map((e) => ({ e, role: a.roleName }))).map(({ e, role }) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper p-3.5 text-sm">
                <div>
                  <span className="font-semibold text-ink">{e.name}</span>
                  <span className="ml-2 text-xs text-ink-faint">{e.kind} · {e.date} · {role}</span>
                </div>
                <span className={`pill text-[11px] ${e.status === 'Accepted (Assessor)' ? 'border-good-line bg-good-soft text-good' : ''}`}>{e.status}</span>
              </li>
            ))}
            {assessments.every((a) => a.evidence.length === 0) && <li className="text-sm text-ink-soft">No evidence recorded yet.</li>}
          </ul>
        </section>
      )}

      {section === 'gap' && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><RadarIcon className="h-5 w-5 text-rose-600" aria-hidden="true" /> Skill Gap Analysis</h2>
            <button onClick={() => setSection(null)} className="btn btn-ghost h-9 w-9 p-0" aria-label="Close"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          {best?.gaps ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-good-line bg-good-soft p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-good">Demonstrated</div>
                <ul className="mt-2 space-y-1 text-sm text-good">{best.gaps.demonstrated.map((s) => <li key={s}>✓ {s}</li>)}</ul>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Needs more evidence</div>
                <ul className="mt-2 space-y-1 text-sm text-amber-700">{best.gaps.needsMoreEvidence.map((s) => <li key={s}>• {s}</li>)}</ul>
              </div>
              <div className="rounded-xl border border-bad-soft bg-bad-soft p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-bad">Learning gaps</div>
                <ul className="mt-2 space-y-1 text-sm text-bad">{best.gaps.learningGaps.map((s) => <li key={s}>• {s}</li>)}</ul>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">Complete an assessment to see your skill gap analysis.</p>
          )}
        </section>
      )}

      {section === 'report' && (
        <section className="card mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><FileSearch className="h-5 w-5 text-violet-600" aria-hidden="true" /> RPL Readiness Report</h2>
            <button onClick={() => setSection(null)} className="btn btn-ghost h-9 w-9 p-0" aria-label="Close"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          {best?.readiness ? (
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div className="sf-shimmer font-display text-6xl font-extrabold">{best.readiness.overall}%</div>
              <div className="text-sm text-ink-soft">
                <div className="font-semibold text-ink">{best.roleName} — preliminary readiness</div>
                <div>Experience {best.readiness.experienceEvidence}% · Coverage {best.readiness.competencyCoverage}% · Assessment {best.readiness.assessmentPerformance}% · Evidence {best.readiness.evidenceCompleteness}%</div>
                <button onClick={openBest} className="btn btn-primary btn-md mt-3">Open full report</button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">No readiness report yet — complete an assessment first.</p>
          )}
        </section>
      )}

      {/* Assistant + disclaimer */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink"><BarChart3 className="h-4.5 w-4.5 text-brand-600" aria-hidden="true" /> How RPL assessment works here</h3>
            <ol className="mt-3 space-y-2 text-sm text-ink-soft">
              {['Describe your experience and record evidence', 'AI extracts skills and maps them to the occupational framework', 'Answer adaptive questions — difficulty follows your answers', 'Review skill gaps and your preliminary readiness indicator', 'Generate the report and consult an authorized RPL assessor'].map((s, i) => (
                <li key={i} className="flex gap-2.5"><span className="sf-logo-tile flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white">{i + 1}</span>{s}</li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">{RPL_DISCLAIMER}</p>
          </div>
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink"><ShieldCheck className="h-4.5 w-4.5 text-emerald-600" aria-hidden="true" /> What AI does — and doesn't — do</h3>
            <ul className="mt-2 space-y-1.5 text-[13px] text-ink-soft">
              <li>✓ Extracts skills and maps competencies from what you describe</li>
              <li>✓ Flags weak or unsupported areas for human verification</li>
              <li>✓ Explains what supports every conclusion it shows</li>
              <li>✗ Never issues certificates or guarantees RPL qualification</li>
              <li>✗ Never replaces an authorized human assessor</li>
            </ul>
          </div>
        </div>
        <AssistantChat assessment={best} />
      </div>

      <div className="mt-8">
        <AssessorLink onOpen={onOpenAssessor} />
      </div>
    </div>
  );
}

/** Small footer link to the assessor/admin console (local data, no auth yet). */
function AssessorLink({ onOpen }: { onOpen: () => void }) {
  const review = loadAssessments().filter(
    (a) => a.status !== 'draft' && a.mappings.some((m) => m.status === 'Evidence Required' || m.status === 'Not Yet Demonstrated'),
  ).length;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
        <div>
          <div className="font-display text-sm font-bold text-ink">Assessor & Admin Console</div>
          <div className="text-xs text-ink-faint">
            Human review layer — {review} assessment(s) currently flagged for human verification.
          </div>
        </div>
      </div>
      <button onClick={onOpen} className="btn btn-ghost btn-md">Open Console</button>
    </div>
  );
}
