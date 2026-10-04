import type {
  AnswerEvaluation,
  CompetencyMapping,
  ExtractedSkill,
  RplAnswers,
  RplAssessment,
  RplDifficulty,
  RplQuestion,
  RplQuestionType,
  ReadinessBreakdown,
  SkillGap,
} from './types';

// ---------------------------------------------------------------------------
// Local (offline-safe) analysis: always available, used for gap analysis,
// readiness math and as the fallback behind the AI extraction.
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'have', 'has', 'had', 'was', 'were', 'are', 'our', 'their', 'his', 'her',
  'from', 'that', 'this', 'then', 'them', 'they', 'will', 'would', 'been', 'being', 'into', 'also',
  'some', 'many', 'very', 'more', 'most', 'much', 'such', 'each', 'when', 'what', 'which', 'while',
  'years', 'year', 'work', 'worked', 'working', 'experience', 'experienced', 'good', 'well',
]);

function words(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s&-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Local skill extraction: matches the role's competency list and the
 * candidate's own words. Deterministic, instant, no network needed.
 */
export function localSkillExtraction(
  experience: { text: string; jobs: string; training: string; tools: string },
  competencies: string[],
): ExtractedSkill[] {
  const corpus = [experience.text, experience.jobs, experience.training, experience.tools].join(' ');
  const w = words(corpus);
  const has = (needle: string) => {
    const n = words(needle);
    return n.length > 0 && n.every((t) => w.includes(t));
  };

  const skills: ExtractedSkill[] = [];
  for (const c of competencies) {
    const hit = has(c);
    const half = words(c).some((t) => w.includes(t));
    if (hit) {
      skills.push({ name: c, category: categoryFor(c), confidence: 'High confidence', source: 'Work experience (self-reported)' });
    } else if (half) {
      skills.push({ name: c, category: categoryFor(c), confidence: 'Medium confidence', source: 'Possible match in experience description' });
    }
  }
  return skills;
}

function categoryFor(name: string): ExtractedSkill['category'] {
  const n = name.toLowerCase();
  if (/(safety|hygiene|privacy|knowledge|theory|principles|reading|awareness)/.test(n)) return 'Knowledge area';
  if (/(communication|service|consultation|handling|reporting|resolution|teamwork)/.test(n)) return 'Soft skill';
  if (/(tools|instruments|machine|software|equipment|systems?|operation)/.test(n)) return 'Tool';
  if (/(installation|management|planning|preparation|setup|checking|inspection)/.test(n)) return 'Process';
  return 'Technical skill';
}

export function mapCompetencies(
  skills: ExtractedSkill[],
  competencies: string[],
): CompetencyMapping[] {
  return competencies.map((c) => {
    const s = findSkillForCompetency(skills, c);
    if (!s) {
      return { competency: c, evidence: 'Not detected', status: 'Not Yet Demonstrated' };
    }
    const evidence = s.source;
    if (s.confidence === 'High confidence') return { competency: c, evidence, status: 'Demonstrated' };
    if (s.confidence === 'Medium confidence') return { competency: c, evidence, status: 'Partially Demonstrated' };
    return { competency: c, evidence, status: 'Evidence Required' };
  });
}

/**
 * AI-extracted skill names rarely match framework competency names exactly
 * ("Domestic wiring installation" vs "Wiring"), so match by exact name first,
 * then by shared meaningful words (length > 3) in both directions.
 */
function findSkillForCompetency(skills: ExtractedSkill[], competency: string): ExtractedSkill | null {
  const cn = competency.toLowerCase();
  const exact = skills.find((s) => s.name.toLowerCase() === cn);
  if (exact) return exact;
  const cWords = words(competency).filter((w) => w.length > 3);
  let best: { skill: ExtractedSkill; score: number } | null = null;
  for (const s of skills) {
    const sWords = words(s.name);
    const sLower = s.name.toLowerCase();
    let score = 0;
    for (const w of cWords) {
      if (sWords.includes(w)) score += 2;
      else if (sLower.includes(w)) score += 1; // e.g. "wiring" inside "rewiring"
    }
    if (score > 0 && (!best || score > best.score)) best = { skill: s, score };
  }
  return best ? best.skill : null;
}

export function computeGaps(
  mappings: CompetencyMapping[],
  answers: RplAnswers,
  questions: RplQuestion[],
): SkillGap {
  // Assessment performance can lift a partially-demonstrated competency or
  // drag a demonstrated one down.
  const qByComp = new Map<string, RplQuestion[]>();
  for (const q of questions) {
    const list = qByComp.get(q.competency) ?? [];
    list.push(q);
    qByComp.set(q.competency, list);
  }
  const weakFromAssessment = new Set<string>();
  const strongFromAssessment = new Set<string>();
  for (const [comp, qs] of qByComp) {
    for (const q of qs) {
      const a = answers[q.id];
      if (!a) continue;
      if (q.type === 'MCQ') {
        if (a.evaluation?.correct) strongFromAssessment.add(comp);
        else weakFromAssessment.add(comp);
      } else if (a.evaluation && a.evaluation.knowledgeEvidence >= 60) {
        strongFromAssessment.add(comp);
      } else if (a.evaluation && a.evaluation.knowledgeEvidence < 45) {
        weakFromAssessment.add(comp);
      }
    }
  }

  const demonstrated = mappings
    .filter((m) => m.status === 'Demonstrated' && !weakFromAssessment.has(m.competency))
    .map((m) => m.competency);
  const partially = mappings.filter((m) => m.status === 'Partially Demonstrated').map((m) => m.competency);
  const missing = mappings.filter((m) => m.status === 'Evidence Required' || m.status === 'Not Yet Demonstrated').map((m) => m.competency);
  for (const [comp, qs] of qByComp) {
    for (const q of qs) {
      const a = answers[q.id];
      if (!a) continue;
      if (q.type === 'MCQ') {
        if (a.evaluation?.correct) strongFromAssessment.add(comp);
        else weakFromAssessment.add(comp);
      } else if (a.evaluation && a.evaluation.knowledgeEvidence >= 60) {
        strongFromAssessment.add(comp);
      } else if (a.evaluation && a.evaluation.knowledgeEvidence < 45) {
        weakFromAssessment.add(comp);
      }
    }
  }

  const needsMoreEvidence = [
    ...new Set([...partially, ...missing.filter((c) => strongFromAssessment.has(c))]),
  ].filter((c) => !demonstrated.includes(c));
  const learningGaps = [...new Set([...missing, ...weakFromAssessment])].filter(
    (c) => !needsMoreEvidence.includes(c) && !demonstrated.includes(c),
  );

  return {
    demonstrated,
    needsMoreEvidence,
    learningGaps,
  };
}

export function computeReadiness(
  a: Pick<RplAssessment, 'experience' | 'evidence' | 'mappings' | 'questions' | 'answers'>,
): ReadinessBreakdown {
  // 1. Experience evidence: how richly the candidate described prior learning.
  const expWords = words([a.experience.text, a.experience.jobs, a.experience.training, a.experience.tools].join(' ')).length;
  const expParts = [a.experience.text, a.experience.jobs, a.experience.training, a.experience.tools].filter((x) => x.trim()).length;
  const experienceEvidence = Math.min(100, Math.round(expWords * 2.2 + expParts * 8));

  // 2. Competency coverage: share of the framework demonstrated or partially.
  const total = a.mappings.length || 1;
  const full = a.mappings.filter((m) => m.status === 'Demonstrated').length;
  const partial = a.mappings.filter((m) => m.status === 'Partially Demonstrated').length;
  const competencyCoverage = Math.round(((full + partial * 0.5) / total) * 100);

  // 3. Assessment performance: MCQ correctness + AI indicator scores.
  const perfScores: number[] = [];
  for (const q of a.questions) {
    const ans = a.answers[q.id];
    if (!ans) continue;
    if (q.type === 'MCQ') perfScores.push(ans.evaluation?.correct ? 100 : 0);
    else if (ans.evaluation) perfScores.push(ans.evaluation.knowledgeEvidence);
  }
  const assessmentPerformance = perfScores.length
    ? Math.round(perfScores.reduce((s, x) => s + x, 0) / perfScores.length)
    : 0;

  // 4. Evidence completeness: variety + count of portfolio items.
  const kinds = new Set(a.evidence.map((e) => e.kind));
  const evidenceCompleteness = Math.max(0, Math.min(100, a.evidence.length * 22 + (kinds.size - 1) * 12));

  const overall = Math.round(
    experienceEvidence * 0.3 + competencyCoverage * 0.3 + assessmentPerformance * 0.25 + evidenceCompleteness * 0.15,
  );
  return { experienceEvidence, competencyCoverage, assessmentPerformance, evidenceCompleteness, overall };
}

/** Adaptive difficulty for the next question based on how the last one went. */
export function nextDifficulty(current: RplQuestion['difficulty'], lastResult: 'good' | 'poor'): RplQuestion['difficulty'] {
  if (lastResult === 'good') {
    return current === 'Beginner' ? 'Intermediate' : 'Advanced';
  }
  return current === 'Advanced' ? 'Intermediate' : 'Beginner';
}

export function evaluateAnswerLocally(
  q: RplQuestion,
  answerText: string,
): AnswerEvaluation {
  // Deterministic heuristic evaluation used when AI is unavailable.
  const w = words(answerText);
  const guidanceTerms = words(q.guidance || '');
  const matched = guidanceTerms.filter((t) => w.includes(t));
  const coverage = guidanceTerms.length ? matched.length / guidanceTerms.length : 0;
  const lengthScore = Math.min(1, w.length / 40);
  const base = Math.round((coverage * 0.7 + lengthScore * 0.3) * 100);

  const safetyTerms = ['safety', 'safe', 'isolate', 'turn off', 'switch off', 'protect', 'careful', 'hazard', 'risk', 'verify', 'check'];
  const safetyHits = safetyTerms.filter((t) => answerText.toLowerCase().includes(t)).length;

  return {
    competency: q.competency,
    knowledgeEvidence: Math.max(8, Math.min(96, base)),
    practicalReasoning: Math.max(5, Math.min(95, Math.round(base * 0.9 + (w.length > 25 ? 6 : 0)))),
    safetyAwareness: Math.max(10, Math.min(97, Math.min(96, 35 + safetyHits * 18))),
    feedback:
      coverage > 0.5
        ? 'Your answer covers the key points an assessor would look for. Add specific details from your own work to strengthen the evidence.'
        : 'A stronger answer would mention more of the key steps or considerations. Think about what a senior colleague would check first.',
  };
}

// ---------------------------------------------------------------------------
// Built-in per-competency MCQ generator: keeps a self-paced competency
// assessment alive when the AI question engine is unreachable.
// ---------------------------------------------------------------------------

const LOCAL_COMPETENCY_QUESTIONS: RplQuestionType[] = ['MCQ', 'Scenario', 'Experience-based'];

export function localCompetencyQuestions(
  role: string,
  competency: string,
  experienceText: string,
  count: number,
): RplQuestion[] {
  const exp = experienceText.trim();
  return Array.from({ length: count }, (_, i): RplQuestion => {
    const type: RplQuestionType = LOCAL_COMPETENCY_QUESTIONS[i % LOCAL_COMPETENCY_QUESTIONS.length];
    const difficulty: RplDifficulty = i === 0 ? 'Beginner' : i === count - 1 ? 'Advanced' : 'Intermediate';
    if (type === 'MCQ') {
      return {
        id: '',
        type: 'MCQ',
        competency,
        difficulty,
        prompt: `Which habit best shows real competence in ${competency} as a ${role}?`,
        options: [
          `Following the standard safe procedure for ${competency.toLowerCase()}, checking your work as you go`,
          'Relying on memory and fixing problems only when something goes wrong',
          'Copying whatever the previous worker did without checking',
          'Skipping preparation steps to finish faster',
        ],
        correctAnswer: 0,
        guidance: `A competent practitioner follows the standard, safe procedure for ${competency} and verifies each step.`,
      };
    }
    if (type === 'Scenario') {
      return {
        id: '',
        type: 'Scenario',
        competency,
        difficulty,
        prompt: `Something goes wrong while you are using ${competency.toLowerCase()} on a job as a ${role}. What do you do first?`,
        options: [
          'Stop, make the situation safe, then work through the steps of the standard procedure for this problem',
          'Try the quickest workaround and check the result later if time allows',
          'Ask a colleague to take over the whole task',
          'Continue as planned and only record the problem at the end of the day',
        ],
        correctAnswer: 0,
        guidance: `Strong answers show safe, systematic problem handling in ${competency}: make it safe first, then follow a clear diagnostic order.`,
      };
    }
    return {
      id: '',
      type: 'Experience-based',
      competency,
      difficulty,
      prompt: exp
        ? `From your own work, describe one job where you used ${competency.toLowerCase()}. What did you do, step by step?`
        : `Describe how you normally use ${competency.toLowerCase()} in your work as a ${role}, step by step.`,
      options: [],
      correctAnswer: -1,
      guidance: `A strong answer describes concrete steps, tools and checks from the candidate's own experience with ${competency}.`,
    };
  });
}
