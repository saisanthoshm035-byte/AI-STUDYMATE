import { describe, expect, it } from 'vitest';

import { SAFETY_RULES, getOccupation, getSafetyRule } from '../src/forge/competencies';
import {
  advance, applyAction, computeResults, createSession, currentNode, pickAdaptiveNode,
} from '../src/forge/engine';
import { buildPlanTemplate, compareReassessment } from '../src/forge/microbridge';
import { DEMO_CHAIN, getNode, SCENARIOS } from '../src/forge/scenarios';
import type { ForgeSession } from '../src/forge/types';

function freshDemoSession(): ForgeSession {
  return createSession('ev-service-technician', 'demo', DEMO_CHAIN[0]);
}

describe('competency graph', () => {
  it('exposes the EV pilot with 6 competencies and the DEMO OCCUPATION tag', () => {
    const occ = getOccupation('ev-service-technician');
    expect(occ.tag).toBe('DEMO OCCUPATION');
    expect(occ.competencies).toHaveLength(6);
    expect(occ.competencies.map((c) => c.id)).toContain('electrical-safety');
  });

  it('marks other occupations as coming soon', () => {
    expect(getOccupation('electrical-technician').tag).toBe('COMING SOON');
  });

  it('resolves safety rules deterministically', () => {
    expect(getSafetyRule('HV_ISOLATION').id).toBe('HV_ISOLATION');
    expect(SAFETY_RULES.HV_VERIFY.detail).toContain('deterministic');
  });
});

describe('scenario bank', () => {
  it('contains level 1-6 nodes and every action names a competency', () => {
    const levels = new Set(Object.values(SCENARIOS).map((s) => s.level));
    expect([...levels].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const node of Object.values(SCENARIOS)) {
      expect(node.actions.length).toBeGreaterThan(0);
      for (const a of node.actions) expect(a.competency).toBeTruthy();
    }
  });

  it('chains the scripted demo path through level 5 safety-critical', () => {
    expect(DEMO_CHAIN).toHaveLength(6);
    expect(getNode(DEMO_CHAIN[4]).level).toBe(5);
    expect(getNode(DEMO_CHAIN[4]).competency).toBe('electrical-safety');
  });
});

describe('adaptive engine', () => {
  it('records correct-verdict evidence and advances through a correct action', () => {
    const session = freshDemoSession();
    const { session: next, response } = applyAction(session, 'scan-codes');
    expect(response.kind).toBe('ok');
    expect(response.verdict).toBe('correct');
    expect(next.evidence).toHaveLength(1);
    expect(next.evidence[0].competency).toBe('battery-diagnostics');
    expect(next.evidence[0].verdict).toBe('correct');
    expect(response.nextNodeId).toBe('ev-l2-no-charge');
    const advanced = advance(next, response.nextNodeId);
    expect(advanced.currentNodeId).toBe('ev-l2-no-charge');
    expect(advanced.level).toBe(2);
  });

  it('records an incorrect action without triggering the safety gate', () => {
    const session = freshDemoSession();
    const { response } = applyAction(session, 'replace-pack');
    expect(response.verdict).toBe('incorrect');
    expect(response.kind).toBe('ok');
  });

  it('BLOCKS an unsafe action deterministically and flags a safety violation', () => {
    let session = freshDemoSession();
    session.currentNodeId = 'ev-l5-hv-safety';
    // 'open-cover-inspect' requires HV_ISOLATION + HV_PPE + HV_VERIFY — none completed.
    const { session: next, response } = applyAction(session, 'open-cover-inspect');
    expect(response.kind).toBe('safety-violation');
    expect(response.verdict).toBe('safety-violation');
    expect(response.violationRule?.id).toBe('HV_ISOLATION');
    expect(next.safetyViolations).toHaveLength(1);
    expect(next.evidence[0].verdict).toBe('safety-violation');
  });

  it('allows the same action once the full HV safety chain is completed in order', () => {
    let session = freshDemoSession();
    session.currentNodeId = 'ev-l5-hv-safety';
    session = applyAction(session, 'wear-ppe').session;
    session = applyAction(session, 'isolate-pack').session;
    session = applyAction(session, 'verify-zero').session;
    expect(session.completedSafety).toEqual(['HV_PPE', 'HV_ISOLATION', 'HV_VERIFY']);
    const { response } = applyAction(session, 'open-cover-inspect');
    expect(response.kind).toBe('ok');
    expect(response.verdict).toBe('correct');
  });

  it('applies data overlays from dataChanges', () => {
    let session = freshDemoSession();
    session.currentNodeId = 'ev-l5-hv-safety';
    session = applyAction(session, 'wear-ppe').session;
    session = applyAction(session, 'isolate-pack').session;
    expect(session.dataOverlay['Service disconnect']).toContain('removed');
  });

  it('pickAdaptiveNode escalates after correct performance and prefers the stress test', () => {
    let session = createSession('ev-service-technician', 'standard', 'ev-l1-power-loss');
    session = applyAction(session, 'scan-codes').session; // correct
    session = advance(session, 'adaptive');
    session = applyAction(session, 'measure-charger-dc').session; // correct again
    const next = pickAdaptiveNode(session);
    expect(next).toBe('ev-l3-stress-thermal'); // stress test after 2 correct in standard mode
  });

  it('pickAdaptiveNode never revisits completed scenarios and ends gracefully', () => {
    let session = createSession('ev-service-technician', 'standard', 'ev-l1-power-loss');
    let guard = 0;
    // 'stay' nodes (e.g. the L5 HV safety chain) keep the same node across
    // actions, so track which actions we have already tried per node.
    const triedPerNode = new Map<string, Set<string>>();
    while (!session.ended && guard++ < 60) {
      const node = currentNode(session);
      const tried = triedPerNode.get(node.id) ?? new Set<string>();
      triedPerNode.set(node.id, tried);
      const pending = node.actions.find((a) => !tried.has(a.id));
      if (!pending) break; // every action on this node exhausted
      tried.add(pending.id);
      const applied = applyAction(session, pending.id);
      const { response } = applied;
      session = advance(applied.session, response.nextNodeId);
    }
    expect(session.ended).toBe(true);
  });
});

describe('results: competency states, boundary, evidence', () => {
  it('labels demonstrated / developing / not-demonstrated from evidence counts', () => {
    let session = freshDemoSession();
    session = applyAction(session, 'scan-codes').session; // battery-diagnostics correct
    const results = computeResults(session);
    const battery = results.competencyResults.find((r) => r.competency.id === 'battery-diagnostics');
    expect(battery?.state).toBe('developing'); // 1 correct
    const thermal = results.competencyResults.find((r) => r.competency.id === 'thermal-management');
    expect(thermal?.state).toBe('insufficient-evidence');
  });

  it('produces a competency boundary statement and safety flag from a violation run', () => {
    let session = freshDemoSession();
    session = applyAction(session, 'scan-codes').session; // correct at L1
    session.currentNodeId = 'ev-l5-hv-safety';
    session = applyAction(session, 'open-cover-inspect').session; // safety violation
    const results = computeResults(session);
    expect(results.safetyViolations).toHaveLength(1);
    expect(results.boundaryStatement).toContain('safety');
    const safety = results.competencyResults.find((r) => r.competency.id === 'electrical-safety');
    expect(safety?.state).toBe('safety-concern');
  });

  it('computes a boundary with reliableUpTo and inconsistentAt across levels', () => {
    let session = freshDemoSession();
    // L1 correct
    session = applyAction(session, 'scan-codes').session;
    // L2 correct
    session = advance(session, 'ev-l2-no-charge');
    session = applyAction(session, 'measure-charger-dc').session;
    // L3 incorrect
    session = advance(session, 'ev-l3-intermittent');
    session = applyAction(session, 'clear-codes').session;
    const results = computeResults(session);
    const bms = results.competencyResults.find((r) => r.competency.id === 'bms-troubleshooting');
    expect(bms?.boundary?.reliableUpTo).toBe(0);
    expect(bms?.boundary?.inconsistentAt).toBe(3);
    // Global boundary: correct at 1-2, incorrect at 3
    expect(results.boundaryStatement).toContain('Level 3');
  });

  it('collects "what you can do" capabilities from correct actions', () => {
    let session = freshDemoSession();
    session = applyAction(session, 'scan-codes').session;
    const results = computeResults(session);
    expect(results.canDo.length).toBeGreaterThan(0);
    expect(results.canDo[0]).toContain('fault data');
  });
});

describe('micro-bridging', () => {
  it('targets the smallest actionable gap and points at the BMS reassessment path', () => {
    let session = freshDemoSession();
    session = applyAction(session, 'scan-codes').session;
    const results = computeResults(session);
    const plan = buildPlanTemplate(results);
    expect(plan.reassessmentScenarioId).toBe('ev-r-bms-reassess');
    expect(plan.concept.readMinutes).toBe(8);
    expect(plan.concept.bullets.length).toBeGreaterThanOrEqual(3);
  });

  it('routes a charging-systems gap to the charging bridge chain, not the BMS chain', () => {
    let session = createSession('ev-service-technician', 'standard', 'ev-l1-power-loss');
    // Only charging-systems evidence (suboptimal at L2) → charging is the gap.
    session = advance(session, 'ev-l2-no-charge');
    session = applyAction(session, 'order-charger').session; // suboptimal, charging-systems
    const results = computeResults(session);
    const plan = buildPlanTemplate(results);
    expect(plan.competencyId).toBe('charging-systems');
    expect(plan.interactiveScenarioId).toBe('ev-m1-charging-sim');
    expect(plan.challengeScenarioId).toBe('ev-m2-charging-challenge');
    expect(plan.reassessmentScenarioId).toBe('ev-r-charging-reassess');
    // The chain itself must stay competency-consistent end to end.
    expect(getNode('ev-m1-charging-sim').competency).toBe('charging-systems');
    expect(getNode('ev-m2-charging-challenge').competency).toBe('charging-systems');
    expect(getNode('ev-r-charging-reassess').competency).toBe('charging-systems');
  });

  it('keeps the BMS challenge inside the bridge chain instead of the adaptive pool', () => {
    const challenge = getNode('ev-m2-bms-challenge');
    const challengeNexts = challenge.actions.map((a) => a.next ?? challenge.next).filter(Boolean) as string[];
    expect(challengeNexts.length).toBeGreaterThan(0);
    expect(challengeNexts.every((n) => n === 'ev-r-bms-reassess')).toBe(true);
    expect(getNode('ev-r-bms-reassess').next).toBeNull();
  });

  it('detects improvement from before/after competency states', () => {
    let session = freshDemoSession();
    session = applyAction(session, 'scan-codes').session;
    const before = computeResults(session);
    const after = computeResults({
      ...session,
      evidence: [
        ...session.evidence,
        {
          id: 'e1', scenarioId: 'ev-l3-intermittent', scenarioTitle: 'Reassessment A', level: 3,
          competency: 'battery-diagnostics', actionLabel: 'scan first', verdict: 'correct',
          note: '', phase: 'reassessment', at: Date.now(),
        },
        {
          id: 'e2', scenarioId: 'ev-l4-conflict', scenarioTitle: 'Reassessment B', level: 4,
          competency: 'battery-diagnostics', actionLabel: 'load test', verdict: 'correct',
          note: '', phase: 'reassessment', at: Date.now(),
        },
      ],
    });
    const cmp = compareReassessment(before, after, 'battery-diagnostics');
    expect(cmp.improved).toBe(true);
    expect(cmp.afterState).toBe('demonstrated');
    expect(cmp.message).toContain('IMPROVEMENT DETECTED');
  });

  it('reports needs-reinforcement when nothing improved', () => {
    let session = freshDemoSession();
    session = applyAction(session, 'scan-codes').session;
    const before = computeResults(session);
    const cmp = compareReassessment(before, before, 'battery-diagnostics');
    expect(cmp.improved).toBe(false);
    expect(cmp.message).toContain('NEEDS REINFORCEMENT');
  });
});
