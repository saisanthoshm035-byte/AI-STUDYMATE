// ---------------------------------------------------------------------------
// SKILLFORGE AI — Micro-Bridging engine.
//
// NOT a generic crash course. The system finds the SMALLEST missing
// competency and builds: 8-min concept → 5-min interactive scenario →
// 3-min decision challenge → reassessment. Then it measures improvement.
//
// ASSESS → DIAGNOSE → INTERVENE → REASSESS → IMPROVE
// ---------------------------------------------------------------------------

import type {
  BridgeComparison,
  CompetencyResult,
  ForgeResults,
  MicroBridgePlan,
} from './types';
import { getBridgeChain } from './scenarios';

interface PlanTemplate {
  conceptTitle: string;
  bullets: string[];
  coachTip: string;
}

/** Expert-defined plan skeletons, one per competency. AI enriches the concept text. */
const PLAN_TEMPLATES: Record<string, PlanTemplate> = {
  'bms-troubleshooting': {
    conceptTitle: 'Read BMS logs the way a technician does',
    bullets: [
      'A BMS report is only as good as its sense wires — always ask "is the meter lying?" before "is the cell failing?"',
      'Real cell faults show up in VOLTAGE and CURRENT behaviour first; pure temperature spikes with stable voltage point to sensing.',
      'Intermittent warnings need reproduction: a controlled fast-charge with logging beats three days of guesswork.',
      'Cross-check any single suspicious reading with an independent instrument (thermal camera, second meter point).',
    ],
    coachTip: 'Before touching a part, name the two log lines that prove your hypothesis.',
  },
  'fault-isolation': {
    conceptTitle: 'Settle conflicting evidence with measurement under load',
    bullets: [
      'Components fail under the failing condition — measure at the failing condition, not at rest.',
      'When two instruments disagree, find the third independent measurement before replacing anything.',
      'Check the instrumentation path (wiring, connectors, sense wires) as a first-class suspect.',
    ],
    coachTip: 'Two instruments disagree? Your job is to referee with a third measurement.',
  },
  'battery-diagnostics': {
    conceptTitle: 'Diagnose load-related shutdowns with data, not swaps',
    bullets: [
      'A symptom that follows a pattern (time, load, temperature) always leaves a trace in logs — find it first.',
      'Never order a replacement pack without a measured failure signature.',
      'Undocumented modifications from previous repairs are prime suspects when old symptoms return.',
    ],
    coachTip: 'Name the measured signature before ordering any part.',
  },
  'charging-systems': {
    conceptTitle: 'Test the source before the sink',
    bullets: [
      'Charging chain: wall → charger → port → BMS FET → cells. Measure each link in order.',
      'A charger reporting near-zero output with good wall power condemns the charger — capture it under load.',
      'Thermal derating is a charger doing its job, not a fault — verify temperature dependency.',
    ],
    coachTip: 'Walk the chain in order; never skip to the expensive end.',
  },
  'electrical-safety': {
    conceptTitle: 'The HV safety chain is non-negotiable',
    bullets: [
      'Isolate → PPE → verify 0 V → only then touch. Every time, no shortcuts, no "just a quick look".',
      'A damaged pack with electrolyte smell is a chemical AND electrical hazard — quarantine, don\'t rush.',
      'These rules are deterministic: no experience level or time pressure overrides them.',
    ],
    coachTip: 'If you cannot name the safety step you just completed, stop and start the chain.',
  },
  'thermal-management': {
    conceptTitle: 'Separate protective derating from real faults',
    bullets: [
      'Pack temperature right after a ride is expected to be high — systems derate on purpose.',
      'Re-test temperature-dependent faults at normal temperature before condemning parts.',
      'Never defeat a thermal protection to "make the test pass".',
    ],
    coachTip: 'Ask: is this system broken, or is it protecting itself?',
  },
};

export function buildPlanTemplate(results: ForgeResults): MicroBridgePlan {
  // Pick the smallest actionable gap: a developing competency beats an absent one.
  const ranked: CompetencyResult[] = [...results.competencyResults].sort((a, b) => {
    const order: Record<string, number> = {
      'developing': 0,
      'not-demonstrated': 1,
      'safety-concern': 2,
      'demonstrated': 3,
      'insufficient-evidence': 4,
    };
    return order[a.state] - order[b.state] || a.strength - b.strength;
  });
  const target =
    ranked.find((r) => r.state === 'developing' || r.state === 'not-demonstrated' || r.state === 'safety-concern') ??
    ranked[0];
  const template = PLAN_TEMPLATES[target.competency.id] ?? {
    conceptTitle: `Strengthening ${target.competency.name}`,
    bullets: [target.competency.description],
    coachTip: 'Focus on the smallest missing piece of this competency.',
  };

  const chain = getBridgeChain(target.competency.id);
  return {
    competencyId: target.competency.id,
    competencyName: target.competency.name,
    concept: {
      title: template.conceptTitle,
      readMinutes: 8,
      bullets: template.bullets,
      source: 'curated',
    },
    interactiveScenarioId: chain.interactive,
    challengeScenarioId: chain.challenge,
    reassessmentScenarioId: chain.reassessment,
    coachTip: template.coachTip,
  };
}

/** Compare before/after results for the bridged competency. */
export function compareReassessment(before: ForgeResults, after: ForgeResults, competencyId: string): BridgeComparison {
  const beforeResult = before.competencyResults.find((r) => r.competency.id === competencyId);
  const afterResult = after.competencyResults.find((r) => r.competency.id === competencyId);
  const stateRank: Record<string, number> = {
    'safety-concern': 0,
    'not-demonstrated': 1,
    'insufficient-evidence': 1,
    'developing': 2,
    'demonstrated': 3,
  };
  const beforeState = beforeResult?.state ?? 'insufficient-evidence';
  const afterState = afterResult?.state ?? 'insufficient-evidence';
  const improved = (stateRank[afterState] ?? 0) > (stateRank[beforeState] ?? 0);

  let message: string;
  if (improved) {
    message =
      afterState === 'demonstrated'
        ? `IMPROVEMENT DETECTED — ${beforeResult?.competency.name} moved from ${beforeState.replace('-', ' ')} to DEMONSTRATED after the micro-bridge and reassessment.`
        : `IMPROVEMENT DETECTED — ${beforeResult?.competency.name} moved from ${beforeState.replace('-', ' ')} to DEVELOPING. The intervention is working; keep practising this competency.`;
  } else {
    message = `NEEDS REINFORCEMENT — ${beforeResult?.competency.name} is still ${afterState.replace('-', ' ')} after reassessment. One micro-bridge is rarely enough; repeat the loop or seek hands-on practice.`;
  }
  return { improved, message, beforeState, afterState };
}

/** Build the reassessment session config for a micro-bridge plan. */
export function reassessmentNodeFor(plan: MicroBridgePlan): string {
  return plan.reassessmentScenarioId;
}
