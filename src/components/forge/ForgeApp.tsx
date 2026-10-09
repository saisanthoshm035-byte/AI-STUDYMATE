// ---------------------------------------------------------------------------
// SKILLFORGE AI — orchestrator. Occupation pick → live job simulation →
// competency boundary + evidence → micro-bridge → reassessment.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react';
import Simulator, { type ReskinState } from './Simulator';
import ForgeResultsView from './ForgeResults';
import MicroBridge from './MicroBridge';
import { forgeApi } from '../../forge/api';
import { OCCUPATIONS, getOccupation } from '../../forge/competencies';
import { DEMO_CHAIN } from '../../forge/scenarios';
import { CURATED_RESKINS, BENCH_CHAIN } from '../../forge/scenarios';
import { buildPlanTemplate } from '../../forge/microbridge';
import { computeResults, createSession, currentNode, type ActionResponse } from '../../forge/engine';
import { loadForgeResults, saveForgeResults, saveForgeSession } from '../../lib/forgeStorage';
import type { ForgeResults, ForgeSession, MicroBridgePlan } from '../../forge/types';

interface ForgeAppProps {
  onHome: () => void;
}

type View =
  | { stage: 'select' }
  | { stage: 'sim'; session: ForgeSession }
  | { stage: 'results'; session: ForgeSession; results: ForgeResults; bridge: MicroBridgePlan | null }
  | { stage: 'bridge'; plan: MicroBridgePlan; before: ForgeResults; session: ForgeSession };

const WHY_NOT = [
  { label: 'Certificate', forge: null },
  { label: 'Resume', forge: null },
  { label: 'Static MCQ', forge: null },
  { label: 'Opaque AI score', forge: null },
];

const FORGE_WAY = [
  'Realistic job scenario',
  'Adaptive branches on every decision',
  'Decision analysis — not answer matching',
  'Deterministic safety gates',
  'Competency boundary — not a score',
  'Auditable evidence trail (WHY?)',
  'Targeted micro-intervention',
  'Reassessment — measure the improvement',
];

export default function ForgeApp({ onHome }: ForgeAppProps) {
  const [view, setView] = useState<View>({ stage: 'select' });
  const [reskin, setReskin] = useState<ReskinState | null>(null);
  const [previousResults] = useState<ForgeResults[]>(() => loadForgeResults());

  const occupation = getOccupation('ev-service-technician');

  // -------- AI scenario reskin (presentation only; curated fallback server-side)
  useEffect(() => {
    if (view.stage !== 'sim') return;
    const node = currentNode(view.session);
    setReskin(null);
    if (!node.aiVariation || view.session.mode !== 'standard') return;
    let cancelled = false;
    void (async () => {
      try {
        const curated = CURATED_RESKINS[node.id]?.[node.aiVariation as string] ?? null;
        const r = await forgeApi.reskin({
          scenarioId: node.id,
          competency: node.competency,
          occupationName: occupation.name,
          level: node.level,
          variation: node.aiVariation as string,
          customerReport: node.customerReport,
          systemData: node.systemData,
          prompt: node.prompt,
          curatedFallback: curated ?? { customerReport: node.customerReport, systemData: node.systemData, prompt: node.prompt },
        });
        if (!cancelled) {
          setReskin({
            variation: node.aiVariation as string,
            customerReport: r.customerReport,
            systemData: r.systemData,
            prompt: r.prompt,
            source: r.source,
            note: r.note,
          });
        }
      } catch {
        /* simulator falls back to the curated node */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, occupation.name]);

  const startSimulation = useCallback((mode: 'demo' | 'standard' | 'bench') => {
    const firstNode = mode === 'demo' ? DEMO_CHAIN[0] : mode === 'bench' ? BENCH_CHAIN[0] : 'ev-l1-power-loss';
    const session = createSession(occupation.id, mode === 'bench' ? 'demo' : mode, firstNode);
    if (mode === 'bench') {
      // BENCH runs as a visually-joined chain: pack bench → fan bench.
      session.currentNodeId = BENCH_CHAIN[0];
    }
    setView({ stage: 'sim', session });
  }, [occupation.id]);

  const handleActionApplied = useCallback((session: ForgeSession, _response: ActionResponse) => {
    saveForgeSession(session);
  }, []);

  const finishSession = useCallback((session: ForgeSession) => {
    const results = computeResults(session);
    saveForgeResults(results);
    const bridge = buildPlanTemplate(results);
    const hasGap = bridge && (results.competencyResults.find((r) => r.competency.id === bridge.competencyId)?.state !== 'demonstrated');
    setView({ stage: 'results', session, results, bridge: hasGap ? bridge : null });
  }, []);

  const handleSessionChange = useCallback((session: ForgeSession) => {
    if (session.ended) {
      finishSession(session);
      return;
    }
    setView((prev) => (prev.stage === 'sim' ? { stage: 'sim', session } : prev));
  }, [finishSession]);

  const startMicroBridge = useCallback(() => {
    if (view.stage !== 'results' || !view.bridge) return;
    const reassessSession = createSession(occupation.id, 'standard', view.bridge.interactiveScenarioId);
    reassessSession.phase = 'reassessment';
    setView({ stage: 'bridge', plan: view.bridge, before: view.results, session: reassessSession });
  }, [view, occupation.id]);

  const onBridgeDone = useCallback((after: ForgeResults) => {
    saveForgeResults(after);
  }, []);

  // ---------------------------------------------------------------- render

  if (view.stage === 'sim') {
    return (
      <Simulator
        session={view.session}
        reskin={reskin}
        onSessionChange={handleSessionChange}
        onActionApplied={handleActionApplied}
        onExit={() => {
          // Exiting mid-run goes to results if there's meaningful evidence, else home.
          if (view.session.evidence.length > 0) finishSession(view.session);
          else onHome();
        }}
      />
    );
  }

  if (view.stage === 'results') {
    return (
      <ForgeResultsView
        results={view.results}
        bridge={view.bridge ? { competencyId: view.bridge.competencyId, competencyName: view.bridge.competencyName } : null}
        onStartMicroBridge={startMicroBridge}
        onRestart={() => setView({ stage: 'select' })}
        onHome={onHome}
      />
    );
  }

  if (view.stage === 'bridge') {
    return (
      <MicroBridge
        plan={view.plan}
        beforeResults={view.before}
        reassessmentSession={view.session}
        competencyDescription={view.plan.competencyName}
        onSessionChange={(s) => setView({ stage: 'bridge', plan: view.plan, before: view.before, session: s })}
        onDone={onBridgeDone}
        onExit={() => {
          const results = computeResults(view.session);
          saveForgeResults(results);
          setView({ stage: 'results', session: view.session, results, bridge: null });
        }}
      />
    );
  }

  // ------------------------------ occupation select ------------------------------
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6" data-testid="forge-select">
      <div className="text-center">
        <span className="sf-badge">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
          SKILLFORGE AI · AI Adaptive Job Simulation
        </span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Don't test what they know.
          <span className="sf-shimmer block">Test what they can do.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Step into a live job scenario. The AI adapts the situation to every decision you make, finds the boundary of your
          competency, and shows the evidence — no certificates, no question banks.
        </p>
      </div>

      {/* -------- occupation picker -------- */}
      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
        {OCCUPATIONS.map((o) => {
          const isPilot = o.tag === 'DEMO OCCUPATION';
          return (
            <button
              key={o.id}
              disabled={!isPilot}
              onClick={() => setView({ stage: 'select' })}
              className={`sf-card relative p-5 text-left transition ${isPilot ? 'border-cyan-400/40 hover:-translate-y-1 hover:border-cyan-300/70' : 'cursor-not-allowed opacity-50'}`}
            >
              <span className={`absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider ${isPilot ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 text-slate-300'}`}>
                {o.tag}
              </span>
              <div className="pt-2 font-display text-base font-extrabold text-white">{o.name}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{o.description}</p>
              <div className="mt-3 text-[11px] text-slate-500">{isPilot ? `${o.competencies.length} competencies · 10+ branching scenarios` : 'Framework under validation'}</div>
            </button>
          );
        })}
      </div>

      {/* -------- competency graph preview -------- */}
      <div className="mx-auto mt-8 max-w-4xl sf-card p-5">
        <div className="text-xs font-bold tracking-[0.12em] text-slate-400">COMPETENCY GRAPH · {occupation.name.toUpperCase()}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {occupation.competencies.map((c) => (
            <span key={c.id} className="sf-chip" title={c.description}>{c.icon} {c.name}</span>
          ))}
        </div>
      </div>

      {/* -------- futuristic work surfaces: bench sim + SkillVision -------- */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
        <div className="sf-card sf-card-hot p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-cyan-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> VIRTUAL EQUIPMENT BENCH
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Work an interactive <span className="font-bold text-white">HV pack bench</span> (isolation links, cells, hot joint)
            and a <span className="font-bold text-white">BLDC fan rig</span> (capacitor, windings, rotor). Click zones ON the
            machine — every action visibly changes the equipment and runs through the same deterministic engine.
          </p>
          <button
            onClick={() => startSimulation('bench')}
            className="sf-btn-ghost btn btn-md mt-3 w-full"
            data-testid="forge-start-bench"
          >
            ⚡ Start Bench Simulation (equipment-first)
          </button>
        </div>
        <div className="sf-card sf-card-hot p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-cyan-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> SKILLVISION · CAMERA-EVIDENCED
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Point a webcam at your real hands or equipment and press <span className="font-bold text-white">"Watch my work"</span>.
            The AI observes what you physically do — no reading, no forms, no literacy barrier — and records concrete,
            confidence-tagged workspace observations. Observations are evidence hints for the human assessor,
            <span className="text-slate-400"> never a verdict or certificate.</span>
          </p>
          <div className="mt-3 rounded-lg border border-cyan-400/25 bg-cyan-500/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
            SkillVision activates inside the simulation — every scenario and bench run shows a camera capture strip,
            so a candidate who cannot read can still be evaluated on what their hands demonstrate.
          </div>
        </div>
      </div>

      {/* -------- start buttons -------- */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
        <button onClick={() => startSimulation('demo')} className="sf-btn-primary btn btn-xl" data-testid="forge-start-demo">
          <Zap className="h-5 w-5" aria-hidden="true" /> Start Live Job Simulation
        </button>
        <button onClick={() => startSimulation('standard')} className="sf-btn-ghost btn btn-xl">
          <Target className="h-5 w-5" aria-hidden="true" /> Full Adaptive Simulation
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">
        Demo mode: a scripted 6-scenario journey (basic → safety-critical → complication). Full mode: AI adapts difficulty and inserts stress tests.
      </p>

      {previousResults.length > 0 && (
        <div className="mx-auto mt-6 max-w-4xl rounded-xl border border-slate-700/60 bg-slate-800/30 px-4 py-3 text-center text-xs text-slate-400">
          You have {previousResults.length} previous simulation result{previousResults.length > 1 ? 's' : ''} on this device. Run a new simulation to compare.
        </div>
      )}

      {/* -------- WHY NOT A NORMAL TEST? (judge attack mode) -------- */}
      <div className="mx-auto mt-14 max-w-4xl" id="why-not-normal">
        <div className="text-center">
          <h2 className="font-display text-2xl font-extrabold text-white">Why not a normal test?</h2>
          <p className="mt-2 text-sm text-slate-400">Because the job doesn't ask multiple-choice questions.</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="sf-card p-5 opacity-80">
            <div className="text-xs font-bold tracking-wider text-slate-500">TRADITIONAL</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {WHY_NOT.map((w) => (
                <li key={w.label} className="flex items-center gap-2"><ChevronRight className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" /> {w.label}</li>
              ))}
              <li className="pt-1 text-xs text-slate-500">→ static score → certificate → hope</li>
            </ul>
          </div>
          <div className="sf-card sf-card-hot p-5">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-cyan-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> SKILLFORGE
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {FORGE_WAY.map((f) => (
                <li key={f} className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" /> {f}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-5 text-center text-sm text-slate-400">
          "We do not ask employers to trust an AI score. We show how the candidate responds to the job."
        </p>
      </div>

      {/* -------- loop strip -------- */}
      <div className="mx-auto mt-12 max-w-4xl">
        <div className="sf-strip flex flex-wrap items-center justify-center gap-x-2 gap-y-2 rounded-2xl px-4 py-4">
          {['JOB SCENARIO', 'ACTION', 'CONSEQUENCE', 'ADAPTIVE SCENARIO', 'COMPETENCY BOUNDARY', 'MICRO-BRIDGE', 'REASSESS'].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="sf-chip">{s}</span>
              {i < arr.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />}
            </span>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-500">
        AI-assisted competency assessment for workforce development. AI never issues certification, makes hiring decisions,
        or overrides safety rules — final decisions stay with authorized human assessors and employers.
      </p>
    </div>
  );
}
