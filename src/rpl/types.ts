// ---------------------------------------------------------------------------
// RPL (Recognition of Prior Learning) — additive type layer.
// The existing StudyMate types (types.ts) are untouched.
// ---------------------------------------------------------------------------

export type RplEvidenceStatus =
  | 'Uploaded'
  | 'AI Analyzed'
  | 'Candidate Provided'
  | 'Requires Human Verification'
  | 'Accepted (Assessor)'
  | 'More Evidence Requested';

export type RplEvidenceKind =
  | 'Certificate'
  | 'Experience Letter'
  | 'Training Document'
  | 'Portfolio File'
  | 'Project Documentation'
  | 'Image'
  | 'Other';

export interface RplEvidenceItem {
  id: string;
  name: string;
  kind: RplEvidenceKind;
  date: string; // ISO date (yyyy-mm-dd)
  relatedSkill: string;
  status: RplEvidenceStatus;
  /** Metadata only — file bytes are never stored or uploaded anywhere. */
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  demo?: boolean;
}

export interface CandidateProfile {
  fullName: string;
  age: string;
  location: string;
  education: string;
  occupation: string;
  yearsExperience: string;
  employmentType: string;
  language: string;
}

export type SkillConfidence = 'High confidence' | 'Medium confidence' | 'Needs evidence';

export type SkillCategory = 'Technical skill' | 'Soft skill' | 'Tool' | 'Process' | 'Knowledge area';

export interface ExtractedSkill {
  name: string;
  category: SkillCategory;
  confidence: SkillConfidence;
  /** What supports the detection: "Work experience", "Uploaded evidence", "Self-learning", … */
  source: string;
}

export type MappingStatus =
  | 'Demonstrated'
  | 'Partially Demonstrated'
  | 'Evidence Required'
  | 'Not Yet Demonstrated';

export interface CompetencyMapping {
  competency: string;
  evidence: string; // "Work experience", "Portfolio + experience", "Not detected", …
  status: MappingStatus;
}

export interface RplExperience {
  text: string; // "Describe your experience in your own words."
  jobs: string; // previous jobs / apprenticeships / internships
  training: string; // informal training / self-learning
  tools: string; // tools & equipment used
}

export type RplQuestionType = 'MCQ' | 'Scenario' | 'Situational' | 'Technical' | 'Experience-based';
export type RplDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface RplQuestion {
  id: string;
  type: RplQuestionType;
  competency: string;
  difficulty: RplDifficulty;
  prompt: string;
  /** 4 options for objective types; empty array for Experience-based. */
  options: string[];
  /** Correct index for objective types; -1 for open questions. */
  correctAnswer: number;
  /** What a strong answer covers (shown to assessor / used by AI evaluation). */
  guidance?: string;
}

export interface AnswerEvaluation {
  competency: string;
  knowledgeEvidence: number; // 0-100 "AI Assessment Indicator"
  practicalReasoning: number;
  safetyAwareness: number;
  feedback: string;
  /** MCQ answers are auto-scored, not AI-evaluated. */
  autoScored?: boolean;
  correct?: boolean;
}

export interface RplAnswer {
  text?: string;
  chosen?: number;
  evaluation?: AnswerEvaluation;
  /** Skipped by the adaptive sequencer (jumped ahead / stayed easier). */
  skippedByAdaptive?: boolean;
}

export type RplAnswers = Record<string, RplAnswer>;

export interface SkillGap {
  demonstrated: string[];
  needsMoreEvidence: string[];
  learningGaps: string[];
}

export interface ReadinessBreakdown {
  experienceEvidence: number; // 0-100
  competencyCoverage: number;
  assessmentPerformance: number;
  evidenceCompleteness: number;
  overall: number;
}

export interface RplReportSection {
  heading: string;
  body: string[]; // paragraphs / bullet lines
}

export interface RplReport {
  intro: string;
  sections: RplReportSection[];
  nextSteps: string[];
  source: 'ai' | 'demo';
  model: string;
}

export type RplAssessmentStatus = 'draft' | 'analyzed' | 'assessed' | 'complete';

export interface RplAssessment {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: RplAssessmentStatus;
  demo?: boolean;
  profile: CandidateProfile;
  roleId: string;
  roleName: string;
  competencies: string[];
  experience: RplExperience;
  evidence: RplEvidenceItem[];
  skills: ExtractedSkill[];
  mappings: CompetencyMapping[];
  questions: RplQuestion[];
  answers: RplAnswers;
  gaps: SkillGap | null;
  readiness: ReadinessBreakdown | null;
  report: RplReport | null;
  assessorReview: { decision: string; notes: string; at: number } | null;
}

export const RPL_LANGUAGES = ['English', 'தமிழ்', 'हिन्दी', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം'] as const;

export const RPL_DISCLAIMER =
  'AI-generated preliminary assessment. Final competency decisions should be made through appropriate human/authorized assessment processes.';

export const RPL_READINESS_DISCLAIMER =
  'AI-generated RPL readiness indicator — not an official certification result.';

export const RPL_PRIVACY_NOTICE =
  'Your uploaded information is used to assist with this preliminary assessment. File contents never leave this device — only file names and details you type are stored.';
