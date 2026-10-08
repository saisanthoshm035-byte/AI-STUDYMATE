// ---------------------------------------------------------------------------
// SKILLFORGE AI — Results: Your Skill Map. Competency STATES (not opaque
// scores), the competency boundary, the evidence trail (WHY?), and the
// micro-bridge call to action.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronRight, CircleAlert, HelpCircle,
  ShieldAlert, Sparkles, Target, TrendingUp, Wrench, XCircle,
} from 'lucide-react';
import { LEVEL_NAMES } from '../../forge/engine';
import type { CompetencyResult, CompetencyState, ForgeResults } from '../../forge/types';

const STATE_META: Record<CompetencyState, { label: string; icon: typeof CheckCircle2; chip: string }> = {
  'demonstrated': { label: '🟢 Demonstrated', icon: CheckCircle2, chip: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' },
  'developing': { label: '🟡 Developing', icon: TrendingUp, chip: 'border-amber-400/40 bg-amber-500/10 text-amber-300' },
  'not-demonstrated': { label: '🔴 Not demonstrated', icon: XCircle, chip: 'border-red-400/40 bg-red-500/10 text-red-300' },
  'safety-concern': { label: '⚠️ Safety concern', icon: ShieldAlert, chip: 'border-red-400/60 bg-red-500/15 text-red-200' },
  'insufficient-evidence': { label: '🔵 Insufficient evidence', icon: HelpCircle, chip: 'border-sky-400/40 bg-sky-500/10 text-sky-300' },
};

const BAR_COLOR: Record<CompetencyState, string> = {
  'demonstrated': 'bg-emerald-400',
  'developing': 'bg-amber-400',
  'not-demonstrated': 'bg-red-400',
  'safety-concern': 'bg-red-500',
  'insufficient-evidence': 'bg-sky-400',
};

function EvidenceRow({ result }: { result: CompetencyResult }) {
  if (result.evidence.length === 0) {
    return <p className="px-1 py-2 text-sm text-slate-500">No scenarios touched this competency in this run.</p>;
  }
  return (
    <ul className="space-y-2 px-1 py-2">
      {result.evidence.map((e) => (
        <li key={e.id} className="rounded-lg border border-slate-700/60 bg-slate-800/30 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className={e.verdict === 'correct' ? 'text-emerald-300' : e.verdict === 'safety-violation' ? 'text-red-300' : 'text-amber-300'}>
              {e.verdict === 'correct' ? '✓ correct' : e.verdict === 'safety-violation' ? '⚠ SAFETY VIOLATION' : '△ suboptimal'}
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">{e.scenarioTitle}</span>
            <span className="text-slate-500">· Level {e.level} ({LEVEL_NAMES[e.level]})</span>
            {e.phase !== 'simulation' && <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-200">{e.phase}</span>}
          </div>
          <div className="mt-1 text-sm text-slate-300">“{e.actionLabel}”</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{e.note}</p>
        </li>
      ))}
    </ul>
  );
}

interface ForgeResultsProps {
  results: ForgeResults;
  bridge: { competencyId: string; competencyName: string } | null;
  onStartMicroBridge: () => void;
  onRestart: () => void;
  onHome: () => void;
}

export default function ForgeResultsView({ results, bridge, onStartMicroBridge, onRestart, onHome }: ForgeResultsProps) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6" data-testid="forge-results">
      <div className="text-center">
        <span className="sf-badge">Simulation complete</span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Your Skill Map</h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-400">
          Competency states from your performance inside the job simulation — not a percentage, a boundary.
        </p>
      </div>

      {/* --------------- competency boundary --------------- */}
      <div className="mt-8 rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-6" data-testid="forge-boundary">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-indigo-300">
          <Target className="h-4 w-4" aria-hidden="true" /> COMPETENCY BOUNDARY
        </div>
        <p className="mt-2.5 font-display text-lg leading-relaxed text-white">{results.boundaryStatement}</p>
        {results.safetyViolations.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
            <div className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" aria-hidden="true" /> Safety flags (deterministic)</div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
              {results.safetyViolations.map((v, i) => (
                <li key={i}>{v.ruleName} — skipped during “{v.actionLabel}”</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* --------------- skill map --------------- */}
      <div className="mt-6 space-y-3">
        {results.competencyResults.map((r) => {
          const meta = STATE_META[r.state];
          const isOpen = open === r.competency.id;
          return (
            <div key={r.competency.id} className="sf-card p-4">
              <button
                onClick={() => setOpen(isOpen ? null : r.competency.id)}
                className="flex w-full items-center gap-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-xl" aria-hidden="true">{r.competency.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-sm font-extrabold text-white">{r.competency.name}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.chip}`}>{meta.label}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full transition-all duration-700 ${BAR_COLOR[r.state]}`} style={{ width: `${r.strength}%` }} />
                  </div>
                  {r.boundary && (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{r.boundary.statement}</p>
                  )}
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />}
              </button>
              {isOpen && (
                <div className="mt-3 border-t border-slate-700/50 pt-2">
                  <div className="flex items-center gap-1.5 px-1 pb-1 text-[11px] font-bold tracking-wider text-slate-500">
                    <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" /> WHY? — EVIDENCE TRAIL
                  </div>
                  <EvidenceRow result={r} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --------------- can do / struggle / practice --------------- */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="sf-card p-4">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-300"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> WHAT YOU CAN DO</div>
          <ul className="mt-2.5 space-y-1.5 text-sm text-slate-300">
            {results.canDo.length > 0 ? results.canDo.map((c) => <li key={c} className="flex gap-2"><span aria-hidden="true">✓</span>{c}</li>) : <li className="text-slate-500">No capability demonstrated yet in this run.</li>}
          </ul>
        </div>
        <div className="sf-card p-4">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-300"><CircleAlert className="h-4 w-4" aria-hidden="true" /> WHERE YOU STRUGGLE</div>
          <ul className="mt-2.5 space-y-1.5 text-sm text-slate-300">
            {results.struggles.length > 0 ? results.struggles.map((c) => <li key={c} className="flex gap-2"><span aria-hidden="true">△</span>{c}</li>) : <li className="text-slate-500">No struggles observed in this run.</li>}
          </ul>
        </div>
        <div className="sf-card p-4">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-cyan-300"><Wrench className="h-4 w-4" aria-hidden="true" /> WHAT TO PRACTICE</div>
          <ul className="mt-2.5 space-y-1.5 text-sm text-slate-300">
            {results.practice.length > 0 ? results.practice.map((c) => <li key={c} className="flex gap-2"><span aria-hidden="true">→</span>{c}</li>) : <li className="text-slate-500">Keep building on what you demonstrated.</li>}
          </ul>
        </div>
      </div>

      {/* --------------- micro-bridge CTA --------------- */}
      {bridge && (
        <div className="mt-8 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-6 text-center" data-testid="forge-bridge-cta">
          <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-[0.12em] text-fuchsia-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> SKILL GAP IDENTIFIED
          </div>
          <p className="mt-2 font-display text-lg font-extrabold text-white">Skill gap: {bridge.competencyName}</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-300">
            One micro-bridge targets the smallest missing piece — an 8-minute concept, a 5-minute interactive scenario, a 3-minute decision challenge, then reassessment.
          </p>
          <button onClick={onStartMicroBridge} className="sf-btn-primary btn btn-xl mt-4">
            Start 5-Minute Micro-Bridge
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={onRestart} className="sf-btn-ghost btn btn-lg">Run Another Simulation</button>
        <button onClick={onHome} className="sf-btn-ghost btn btn-lg">Back to Home</button>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        AI-assisted competency assessment for demonstration — not an official certification, employment decision or safety qualification.
      </p>
    </div>
  );
}
