// ---------------------------------------------------------------------------
// SKILLFORGE AI — AI Adaptive Job Simulation & Workforce Skill Intelligence
// Core type model. "Don't test what they know. Test what they can do."
// ---------------------------------------------------------------------------

// ------------------------------------------------ occupations + competencies

export interface Competency {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Occupation {
  id: string;
  name: string;
  /** Visible pilot label — we never pretend more than one occupation is validated. */
  tag: 'DEMO OCCUPATION' | 'COMING SOON';
  description: string;
  competencies: Competency[];
}

// ------------------------------------------------------------ safety engine

export interface SafetyRule {
  id: string;
  name: string;
  detail: string;
}

// ---------------------------------------------------------------- scenarios

export type ActionVerdict = 'correct' | 'suboptimal' | 'incorrect';

export type DataStatus = 'ok' | 'warn' | 'alert' | 'idle';

export interface SystemDatum {
  label: string;
  value: string;
  status: DataStatus;
}

export interface SimTool {
  id: string;
  label: string;
  icon: string;
}

export interface SimAction {
  id: string;
  label: string;
  icon: string;
  competency: string;
  /** Safety preconditions — if unmet, the DETERMINISTIC safety engine blocks the action. */
  requires?: string[];
  /** Safety rules this action completes when performed. */
  completes?: string[];
  verdict?: ActionVerdict;
  capabilities: string[];
  response: string;
  /** Overrides for live system data after this action (label → value). */
  dataChanges?: Record<string, string>;
  /** Next scenario node id, 'adaptive', 'stay' (remain on this node), or null to end the simulation. */
  next?: string | null | 'stay';
}

export interface ScenarioNode {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  competency: string;
  title: string;
  customerReport: string;
  systemData: SystemDatum[];
  tools: SimTool[];
  prompt: string;
  actions: SimAction[];
  /** Fallback node when the chosen action has no explicit `next`. 'stay' = multi-step scenario. */
  next?: string | null | 'stay';
  /** Optional lower-pressure retry node when the candidate chooses an incorrect action. */
  onIncorrect?: string;
  /**
   * When set, the app asks the AI to re-skin this scenario (customer report,
   * symptoms and live data only — never the actions, branches or safety
   * rules) before it is shown. Curated reskins ship as fallback.
   */
  aiVariation?: 'stress-symptom' | 'misleading-customer' | 'prior-work' | null;
  source: 'curated' | 'ai';
}

// ----------------------------------------------------------------- sessions

export type EvidenceVerdict = ActionVerdict | 'safety-violation';

export interface EvidenceItem {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  level: number;
  competency: string;
  actionLabel: string;
  verdict: EvidenceVerdict;
  note: string;
  phase: 'simulation' | 'reassessment' | 'micro-bridge';
  at: number;
}

export interface SafetyViolation {
  ruleId: string;
  ruleName: string;
  actionLabel: string;
  scenarioId: string;
  at: number;
}

export interface HistoryStep {
  scenarioId: string;
  actionId: string;
  verdict: EvidenceVerdict;
  level: number;
}

export interface ForgeSession {
  id: string;
  occupationId: string;
  mode: 'demo' | 'standard';
  currentNodeId: string;
  level: number;
  step: number;
  completedSafety: string[];
  /** Live-data overlay: label → value, applied on top of the node's systemData. */
  dataOverlay: Record<string, string>;
  evidence: EvidenceItem[];
  safetyViolations: SafetyViolation[];
  history: HistoryStep[];
  ended: boolean;
  phase: 'simulation' | 'reassessment';
  startedAt: number;
  endedAt?: number;
}

// -------------------------------------------------------------- AI reskins

/** AI-generated re-skin of a scenario's presentation layer (never its logic). */
export interface ScenarioReskin {
  title?: string;
  customerReport: string;
  systemData: SystemDatum[];
  prompt: string;
  note?: string;
}

// ------------------------------------------------------------------ results

export type CompetencyState =
  | 'demonstrated'
  | 'developing'
  | 'not-demonstrated'
  | 'safety-concern'
  | 'insufficient-evidence';

export interface CompetencyBoundary {
  reliableUpTo: number;
  inconsistentAt: number | null;
  statement: string;
}

export interface CompetencyResult {
  competency: Competency;
  state: CompetencyState;
  evidence: EvidenceItem[];
  /** 0–100 bar length for the skill map. The STATE, not the number, is the headline. */
  strength: number;
  correctLevels: number[];
  boundary: CompetencyBoundary | null;
}

export interface ForgeResults {
  occupationId: string;
  competencyResults: CompetencyResult[];
  safetyViolations: SafetyViolation[];
  boundaryStatement: string;
  canDo: string[];
  struggles: string[];
  practice: string[];
  strongest: string | null;
  weakest: string | null;
  completedAt: number;
}

// ------------------------------------------------------------- micro-bridge

export interface MicroBridgePlan {
  competencyId: string;
  competencyName: string;
  concept: {
    title: string;
    readMinutes: number;
    bullets: string[];
    source: 'ai' | 'curated';
  };
  interactiveScenarioId: string;
  challengeScenarioId: string;
  reassessmentScenarioId: string;
  coachTip: string;
}

export interface BridgeComparison {
  improved: boolean;
  message: string;
  beforeState: CompetencyState;
  afterState: CompetencyState;
}
