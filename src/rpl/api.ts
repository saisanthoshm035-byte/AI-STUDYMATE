import type {
  AnswerEvaluation,
  ExtractedSkill,
  RplQuestion,
  RplReport,
} from './types';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// All RPL AI calls follow the same contract as the StudyMate ones: the server
// always answers with a valid payload (AI or built-in fallback), so the UI
// never breaks mid-assessment. A thrown error means a transport problem.
export const rplApi = {
  extractSkills(input: {
    role: string;
    competencies: string[];
    experience: { text: string; jobs: string; training: string; tools: string };
    evidenceNames: string[];
  }): Promise<{ skills: ExtractedSkill[] }> {
    return post('/api/rpl/skills', input);
  },

  generateQuestions(input: {
    role: string;
    competencies: string[];
    weakCompetencies: string[];
    experienceText: string;
    language: string;
    /** Total number of questions wanted (defaults to the classic 5). */
    count?: number;
  }): Promise<{ questions: RplQuestion[] }> {
    return post('/api/rpl/questions', input);
  },

  /** Combined analysis across every completed competency assessment. */
  combinedAnalysis(input: {
    role: string;
    competencyResults: { competency: string; scorePercent: number; answeredCount: number; totalQuestions: number }[];
    mappings: { competency: string; evidence: string; status: string }[];
  }): Promise<{ summary: string; strengths: string[]; improvements: string[] }> {
    return post('/api/rpl/interview/combined-analysis', input);
  },

  evaluateAnswer(input: {
    role: string;
    competency: string;
    question: string;
    guidance?: string;
    answer: string;
  }): Promise<{ evaluation: AnswerEvaluation }> {
    return post('/api/rpl/evaluate', input);
  },

  report(input: {
    profile: Record<string, string>;
    role: string;
    competencies: string[];
    mappings: { competency: string; evidence: string; status: string }[];
    skills: ExtractedSkill[];
    gaps: { demonstrated: string[]; needsMoreEvidence: string[]; learningGaps: string[] };
    readiness: Record<string, number>;
    assessmentSummary: { answered: number; total: number };
    evidence: { name: string; kind: string; status: string }[];
  }): Promise<{ report: RplReport }> {
    return post('/api/rpl/report', input);
  },

  askAssistant(input: {
    question: string;
    context: {
      role?: string;
      yearsExperience?: string;
      topSkills?: string[];
      gaps?: string[];
      readiness?: number;
    };
  }): Promise<{ answer: string }> {
    return post('/api/rpl/assistant', input);
  },
};
