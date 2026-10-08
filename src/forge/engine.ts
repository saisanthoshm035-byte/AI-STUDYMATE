// ---------------------------------------------------------------------------
// SKILLFORGE AI — adaptive job-simulation engine (pure, deterministic).
//
// The LLM never runs this logic. It may re-skin presentation and interpret
// free text; branching, safety enforcement, evidence and competency-boundary
// detection are all decided HERE, so the assessment stays auditable.
// ---------------------------------------------------------------------------

import { getOccupation, getSafetyRule } from './competencies';
import { getNode, ADAPTIVE_POOL } from './scenarios';
import type {
  ActionVerdict,
  CompetencyResult,
  CompetencyState,
  EvidenceItem,
  EvidenceVerdict,
  ForgeResults,
  ForgeSession,
  SafetyRule,
  ScenarioNode,
  SystemDatum,
} from './types';

export const LEVEL_NAMES: Record<number, string> = {
  1: 'basic task',
  2: 'multiple possible causes',
  3: 'intermittent fault',
  4: 'conflicting evidence',
  5: 'safety-critical conditions',
  6: 'unexpected complication',
};

export function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ------------------------------------------------------------------ sessions

export function createSession(occupationId: string, mode: 'demo' | 'standard', firstNodeId: string): ForgeSession {
  return {
    id: makeId('forge'),
    occupationId,
    mode,
    currentNodeId: firstNodeId,
    level: getNode(firstNodeId).level,
    step: 1,
    completedSafety: [],
    dataOverlay: {},
    evidence: [],
    safetyViolations: [],
    history: [],
    ended: false,
    phase: 'simulation',
    startedAt: Date.now(),
  };
}

export function currentNode(session: ForgeSession): ScenarioNode {
  return getNode(session.currentNodeId);
}

/** Node's live data with the session's overlay applied (label → value). */
export function getLiveSystemData(node: ScenarioNode, session: ForgeSession): SystemDatum[] {
  return node.systemData.map((d) => {
    const override = session.dataOverlay[d.label];
    return override ? { ...d, value: override } : d;
  });
}

/** Deterministic safety checklist for the current node's rule set. */
export function safetyChecklist(session: ForgeSession): { rule: SafetyRule; done: boolean }[] {
  const ids = ['HV_ISOLATION', 'HV_PPE', 'HV_VERIFY', 'CHARGE_DISABLE'];
  return ids.map((id) => ({ rule: getSafetyRule(id), done: session.completedSafety.includes(id) }));
}

// ------------------------------------------------------------- action engine

export interface ActionResponse {
  kind: 'ok' | 'safety-violation';
  actionId: string;
  label: string;
  verdict: EvidenceVerdict | null;
  text: string;
  capabilities: string[];
  violationRule: SafetyRule | null;
  nextNodeId: string | null | 'adaptive';
  nodeDone: boolean;
}

function recordEvidence(
  session: ForgeSession,
  node: ScenarioNode,
  actionLabel: string,
  competency: string,
  verdict: EvidenceVerdict,
  note: string,
  level: number,
): EvidenceItem {
  const item: EvidenceItem = {
    id: makeId('ev'),
    scenarioId: node.id,
    scenarioTitle: node.title,
    level,
    competency,
    actionLabel,
    verdict,
    note,
    phase: session.phase,
    at: Date.now(),
  };
  session.evidence.push(item);
  session.history.push({ scenarioId: node.id, actionId: item.id, verdict, level });
  return item;
}

/**
 * Apply a candidate's action. SAFETY IS DETERMINISTIC: if the action's
 * mandatory preconditions are unmet, the action is blocked and flagged as a
 * SAFETY VIOLATION regardless of any AI interpretation. No AI output can
 * override this gate.
 */
export function applyAction(input: ForgeSession, actionId: string): { session: ForgeSession; response: ActionResponse } {
  const session: ForgeSession = {
    ...input,
    completedSafety: [...input.completedSafety],
    dataOverlay: { ...input.dataOverlay },
    evidence: [...input.evidence],
    safetyViolations: [...input.safetyViolations],
    history: [...input.history],
  };
  const node = getNode(session.currentNodeId);
  const action = node.actions.find((a) => a.id === actionId);
  if (!action) throw new Error(`Unknown action ${actionId} on node ${node.id}`);

  // ---- deterministic safety gate -----------------------------------------
  const missing = (action.requires ?? []).filter((r) => !session.completedSafety.includes(r));
  if (missing.length > 0) {
    const rule = getSafetyRule(missing[0]);
    session.safetyViolations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      actionLabel: action.label,
      scenarioId: node.id,
      at: Date.now(),
    });
    recordEvidence(
      session,
      node,
      action.label,
      action.competency,
      'safety-violation',
      `Skipped mandatory procedure: ${rule.name}`,
      node.level,
    );
    session.step += 1;
    const response: ActionResponse = {
      kind: 'safety-violation',
      actionId,
      label: action.label,
      verdict: 'safety-violation',
      text: `SAFETY VIOLATION — ${rule.name}. ${rule.detail} The action was blocked before it could be performed. Complete the required safety steps first.`,
      capabilities: [],
      violationRule: rule,
      nextNodeId: action.next ?? session.currentNodeId, // recover in the same scenario
      nodeDone: true,
    };
    return { session, response };
  }

  // ---- normal action -------------------------------------------------------
  for (const ruleId of action.completes ?? []) {
    if (!session.completedSafety.includes(ruleId)) session.completedSafety.push(ruleId);
  }
  const verdict: ActionVerdict = action.verdict ?? 'suboptimal';
  recordEvidence(session, node, action.label, action.competency, verdict, action.response, node.level);
  if (action.dataChanges) Object.assign(session.dataOverlay, action.dataChanges);
  session.step += 1;

  const rawNext = action.next ?? node.next ?? null;
  const response: ActionResponse = {
    kind: 'ok',
    actionId,
    label: action.label,
    verdict,
    text: action.response,
    capabilities: action.capabilities,
    violationRule: null,
    nextNodeId: rawNext,
    nodeDone: rawNext !== 'stay',
  };
  return { session, response };
}

/** Advance the session to the resolved next node (mutates a copy). */
export function advance(input: ForgeSession, next: string | null | 'adaptive' | 'stay'): ForgeSession {
  const session: ForgeSession = { ...input };
  if (next === 'stay') {
    // Multi-step scenario (e.g. the HV safety chain): stay on the same node.
    return session;
  }
  if (next === null) {
    session.ended = true;
    session.endedAt = Date.now();
    return session;
  }
  const nextId = next === 'adaptive' ? pickAdaptiveNode(session) : next;
  if (!nextId) {
    session.ended = true;
    session.endedAt = Date.now();
    return session;
  }
  const node = getNode(nextId);
  session.currentNodeId = nextId;
  session.level = node.level;
  return session;
}

/**
 * Adaptive next-scenario selection (standard mode): escalates difficulty on
 * correct performance, eases off after errors, prefers the stress-test
 * variation once the candidate is rolling, and covers competencies with the
 * least evidence. Fully deterministic.
 */
export function pickAdaptiveNode(session: ForgeSession): string | null {
  const visited = new Set(session.history.map((h) => h.scenarioId));
  const last = session.history[session.history.length - 1];
  const targetLevel = Math.max(1, Math.min(6, (last?.level ?? 1) + (last?.verdict === 'correct' ? 1 : 0)));

  // A safety violation that was never followed by a completed safety scenario
  // must be revisited — safety is not skippable.
  const safetyEvidence = session.evidence.filter((e) => e.competency === 'electrical-safety');
  if (session.safetyViolations.length > 0 && safetyEvidence.every((e) => e.verdict !== 'correct') && !visited.has('ev-l5-hv-safety')) {
    return 'ev-l5-hv-safety';
  }

  // Insert the skill STRESS TEST once the candidate has momentum.
  const correctCount = session.evidence.filter((e) => e.verdict === 'correct').length;
  if (correctCount >= 2 && !visited.has('ev-l3-stress-thermal') && session.mode === 'standard') {
    return 'ev-l3-stress-thermal';
  }

  const candidates = ADAPTIVE_POOL.filter((id) => !visited.has(id));
  if (candidates.length === 0) return null;

  let best: { id: string; score: number } | null = null;
  candidates.forEach((id, i) => {
    const node = getNode(id);
    const evidenceCount = session.evidence.filter((e) => e.competency === node.competency).length;
    const score = Math.abs(node.level - targetLevel) * 10 + evidenceCount * 2 + i * 0.1;
    if (!best || score < best.score) best = { id, score };
  });
  return best ? (best as { id: string }).id : null;
}

// ------------------------------------------------------------------ results

function computeStrength(evidence: EvidenceItem[]): number {
  const correct = evidence.filter((e) => e.verdict === 'correct');
  const suboptimal = evidence.filter((e) => e.verdict === 'suboptimal');
  const violations = evidence.filter((e) => e.verdict === 'safety-violation');
  const maxLevel = correct.reduce((m, e) => Math.max(m, e.level), 0);
  let strength = correct.length * 30 + suboptimal.length * 10 + maxLevel * 8 - violations.length * 45;
  if (violations.length > 0) strength = Math.min(strength, 45);
  return Math.max(0, Math.min(100, strength));
}

function computeBoundary(evidence: EvidenceItem[]) {
  if (evidence.length === 0) return null;
  const byLevel = new Map<number, EvidenceItem[]>();
  for (const e of evidence) {
    const list = byLevel.get(e.level) ?? [];
    list.push(e);
    byLevel.set(e.level, list);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  let reliableUpTo = 0;
  let inconsistentAt: number | null = null;
  for (const lvl of levels) {
    const items = byLevel.get(lvl) ?? [];
    const incorrect = items.filter((e) => e.verdict !== 'correct');
    const correct = items.filter((e) => e.verdict === 'correct');
    if (correct.length > 0 && incorrect.length === 0) {
      reliableUpTo = lvl;
    } else {
      inconsistentAt = lvl;
      break;
    }
  }
  if (reliableUpTo === 0 && inconsistentAt === null) return null;
  let statement: string;
  if (inconsistentAt === null) {
    statement = `Consistent through every level presented (up to Level ${reliableUpTo} — ${LEVEL_NAMES[reliableUpTo] ?? 'advanced'}).`;
  } else if (reliableUpTo === 0) {
    statement = `Performance was inconsistent from the start — Level ${inconsistentAt} (${LEVEL_NAMES[inconsistentAt]}) was not reliably handled.`;
  } else {
    statement = `Consistently handles Level 1–${reliableUpTo} scenarios (${LEVEL_NAMES[reliableUpTo]} and below). Performance becomes inconsistent at Level ${inconsistentAt} — ${LEVEL_NAMES[inconsistentAt]}.`;
  }
  return { reliableUpTo, inconsistentAt, statement };
}

export function computeResults(session: ForgeSession): ForgeResults {
  const occupation = getOccupation(session.occupationId);
  const competencyResults: CompetencyResult[] = occupation.competencies.map((competency) => {
    const evidence = session.evidence.filter((e) => e.competency === competency.id);
    const correct = evidence.filter((e) => e.verdict === 'correct');
    const violations = evidence.filter((e) => e.verdict === 'safety-violation');
    let state: CompetencyState;
    if (violations.length > 0) state = 'safety-concern';
    else if (correct.length >= 2) state = 'demonstrated';
    else if (correct.length === 1) state = 'developing';
    else if (evidence.length > 0) state = 'not-demonstrated';
    else state = 'insufficient-evidence';
    return {
      competency,
      state,
      evidence,
      strength: computeStrength(evidence),
      correctLevels: [...new Set(correct.map((e) => e.level))].sort((a, b) => a - b),
      boundary: computeBoundary(evidence),
    };
  });

  const boundaryWithGap = competencyResults
    .filter((r) => r.boundary?.inconsistentAt)
    .sort((a, b) => (b.boundary?.inconsistentAt ?? 0) - (a.boundary?.inconsistentAt ?? 0))[0];
  const strongest = [...competencyResults]
    .filter((r) => r.state === 'demonstrated' || r.state === 'developing')
    .sort((a, b) => b.strength - a.strength)[0];
  const weakest = [...competencyResults]
    .filter((r) => r.state === 'developing' || r.state === 'not-demonstrated')
    .sort((a, b) => a.strength - b.strength)[0];

  let boundaryStatement: string;
  if (session.safetyViolations.length > 0) {
    boundaryStatement = `One or more mandatory safety procedures were skipped and flagged (deterministic rule, not an AI opinion). ${
      boundaryWithGap
        ? `Beyond safety: ${boundaryWithGap.boundary?.statement}`
        : 'No competency boundary could be assessed beyond the safety flag.'
    }`;
  } else if (boundaryWithGap) {
    boundaryStatement = `You consistently handled ${boundaryWithGap.boundary?.statement.replace('Consistently handles ', '')}`;
  } else if (strongest) {
    boundaryStatement = `No clear competency boundary was hit in this run — performance held up across the scenarios presented.`;
  } else {
    boundaryStatement = 'Insufficient performance data to identify a competency boundary. Run a longer simulation.';
  }

  const canDo = [
    ...new Set(
      session.evidence
        .filter((e) => e.verdict === 'correct')
        .flatMap((e) => {
          const action = getNode(e.scenarioId).actions.find((a) => a.label === e.actionLabel);
          return action?.capabilities ?? [];
        }),
    ),
  ];

  const struggles = competencyResults
    .filter((r) => r.state === 'developing' || r.state === 'not-demonstrated' || r.state === 'safety-concern')
    .map((r) =>
      r.state === 'safety-concern'
        ? `${r.competency.name} — a mandatory safety procedure was skipped`
        : `${r.competency.name} — ${r.boundary?.statement ?? 'not yet reliably demonstrated'}`,
    );

  const practice = competencyResults
    .filter((r) => r.state !== 'demonstrated' && r.state !== 'insufficient-evidence')
    .map((r) => `Practice ${r.competency.name.toLowerCase()}: ${r.competency.description}`);

  return {
    occupationId: occupation.id,
    competencyResults,
    safetyViolations: session.safetyViolations,
    boundaryStatement,
    canDo: canDo.slice(0, 6),
    struggles,
    practice,
    strongest: strongest?.competency.id ?? null,
    weakest: weakest?.competency.id ?? null,
    completedAt: Date.now(),
  };
}
