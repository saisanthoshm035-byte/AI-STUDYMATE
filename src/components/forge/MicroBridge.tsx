// ---------------------------------------------------------------------------
// SKILLFORGE AI — Micro-Bridge: the smallest intervention for the smallest gap.
// Concept (8 min) → Interactive scenario (5 min) → Decision challenge (3 min)
// → Reassessment → IMPROVEMENT DETECTED.
// ---------------------------------------------------------------------------

import { useCallback, useState } from 'react';
import { ArrowRight, CheckCircle2, Lightbulb, RefreshCw, Wrench } from 'lucide-react';
import Simulator from './Simulator';
import { computeResults } from '../../forge/engine';
import { compareReassessment } from '../../forge/microbridge';
import { forgeApi } from '../../forge/api';
import type { ForgeResults, ForgeSession, MicroBridgePlan } from '../../forge/types';

interface MicroBridgeProps {
  plan: MicroBridgePlan;
  beforeResults: ForgeResults;
  reassessmentSession: ForgeSession;
  competencyDescription: string;
  onSessionChange: (s: ForgeSession) => void;
  onDone: (afterResults: ForgeResults) => void;
  onExit: () => void;
}

type Stage = 'concept' | 'interactive' | 'challenge' | 'reassess' | 'result';

export default function MicroBridge({ plan, beforeResults, reassessmentSession, competencyDescription, onSessionChange, onDone, onExit }: MicroBridgeProps) {
  const [stage, setStage] = useState<Stage>('concept');
  const [concept, setConcept] = useState({
    title: plan.concept.title,
    bullets: plan.concept.bullets,
    coachTip: plan.coachTip,
    source: plan.concept.source as 'ai' | 'curated',
  });
  const [enriching, setEnriching] = useState(false);
  const [afterResults, setAfterResults] = useState<ForgeResults | null>(null);
  const [comparison, setComparison] = useState<string>('');

  const enrich = useCallback(() => {
    setEnriching(true);
    void (async () => {
      try {
        const res = await forgeApi.microBridge({
          competencyName: plan.competencyName,
          competencyDescription,
          conceptTitle: plan.concept.title,
          bullets: plan.concept.bullets,
          coachTip: plan.coachTip,
        });
        setConcept({ title: res.title, bullets: res.bullets, coachTip: res.coachTip, source: res.source });
      } catch {
        /* keep curated content */
      } finally {
        setEnriching(false);
      }
    })();
  }, [plan]);

  const stages: { id: Stage; label: string }[] = [
    { id: 'concept', label: 'Concept · 8 min' },
    { id: 'interactive', label: 'Interactive scenario · 5 min' },
    { id: 'challenge', label: 'Decision challenge · 3 min' },
    { id: 'reassess', label: 'Reassessment' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6" data-testid="forge-microbridge">
      {/* stepper */}
      <div className="sf-glass flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="sf-chip sf-chip-good"><Wrench className="h-3.5 w-3.5" aria-hidden="true" /> MICRO-BRIDGE · {plan.competencyName}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {stages.map((s, i) => {
            const activeIdx = stages.findIndex((x) => x.id === stage);
            return (
              <span key={s.id} className={`sf-chip ${i <= activeIdx ? 'sf-chip-good' : ''}`}>{i + 1}. {s.label}</span>
            );
          })}
        </div>
      </div>

      {/* ---------------- stage: concept ---------------- */}
      {stage === 'concept' && (
        <div className="sf-card mt-4 p-6" data-testid="forge-concept">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-cyan-300">
            <Lightbulb className="h-4 w-4" aria-hidden="true" /> STEP 1 · THE CONCEPT {concept.source === 'ai' ? '· AI-enriched' : ''}
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-white">{concept.title}</h2>
          <ul className="mt-4 space-y-3">
            {concept.bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-200">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span className="font-bold">Coach tip:</span> {concept.coachTip}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => setStage('interactive')} className="sf-btn-primary btn btn-lg">
              Practice the Scenario <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {concept.source === 'curated' && (
              <button onClick={enrich} disabled={enriching} className="sf-btn-ghost btn btn-lg">
                {enriching ? 'Enriching…' : '✨ Re-explain with AI'}
              </button>
            )}
            <button onClick={onExit} className="sf-btn-ghost btn btn-lg">Save & exit</button>
          </div>
        </div>
      )}

      {/* ---------------- stage: interactive / challenge / reassess ---------------- */}
      {(stage === 'interactive' || stage === 'challenge' || stage === 'reassess') && (
        <>
          {stage === 'challenge' && (
            <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-200">
              Decision challenge — a fresh angle on the same competency. Trust your reasoning.
            </div>
          )}
          {stage === 'reassess' && (
            <div className="mt-4 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2.5 text-xs text-indigo-200">
              REASSESSMENT — this one counts toward your skill map. {plan.competencyName} under a harder, transfer scenario.
            </div>
          )}
          <Simulator
            session={reassessmentSession}
            reskin={null}
            onSessionChange={onSessionChange}
            onActionApplied={(s, response) => {
              const isLastNode = response.nextNodeId === null || (response.nextNodeId !== 'adaptive' && response.nextNodeId !== s.currentNodeId);
              if (response.nextNodeId === null) {
                const finished = computeResults(s);
                const cmp = compareReassessment(beforeResults, finished, plan.competencyId);
                setComparison(cmp.message);
                setAfterResults(finished);
                setStage('result');
                onDone(finished);
                return;
              }
              if (isLastNode) {
                onSessionChange(s);
                if (stage === 'interactive') setStage('challenge');
                else if (stage === 'challenge') setStage('reassess');
              }
            }}
            onExit={() => {
              if (stage === 'reassess') {
                const finished = computeResults(reassessmentSession);
                const cmp = compareReassessment(beforeResults, finished, plan.competencyId);
                setComparison(cmp.message);
                setAfterResults(finished);
                setStage('result');
                onDone(finished);
              } else {
                onExit();
              }
            }}
          />
        </>
      )}

      {/* ---------------- stage: result ---------------- */}
      {stage === 'result' && afterResults && (
        <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-8 text-center" data-testid="forge-bridge-result">
          <RefreshCw className="mx-auto h-8 w-8 text-emerald-300" aria-hidden="true" />
          <h2 className="mt-3 font-display text-2xl font-extrabold text-white">REASSESSMENT COMPLETE</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">{comparison || 'Compare your before/after competency states below.'}</p>
          <div className="mx-auto mt-5 grid max-w-md gap-3 text-left">
            <div className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3">
              <span className="text-xs font-bold text-slate-400">BEFORE micro-bridge</span>
              <span className="text-sm font-bold text-slate-200">{beforeResults.competencyResults.find((r) => r.competency.id === plan.competencyId)?.state.replace('-', ' ')}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
              <span className="text-xs font-bold text-emerald-300">AFTER micro-bridge</span>
              <span className="text-sm font-bold text-emerald-200">{afterResults.competencyResults.find((r) => r.competency.id === plan.competencyId)?.state.replace('-', ' ')}</span>
            </div>
          </div>
          <button onClick={onExit} className="sf-btn-primary btn btn-xl mt-6">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Done
          </button>
        </div>
      )}
    </div>
  );
}
