/**
 * AI StudyMate — RPL (Recognition of Prior Learning) AI routes.
 *
 * Purely additive: imports the shared callLLM/extractJson helpers from the
 * existing ai.js router module and mounts under /api/rpl/*. Every endpoint
 * answers with a valid payload even when no AI provider is configured or the
 * provider fails — the built-in heuristic engine keeps the demo flow alive.
 *
 * AI rules honored here: label AI output as preliminary, never claim official
 * certification, distinguish claimed vs evidenced skills, flag uncertainty
 * for human review, and allow human assessors to override everything.
 */

import { Router } from 'express';
import { callLLM, extractJson, aiStatus, SYSTEM_PROMPT } from './ai.js';

const router = Router();

function str(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function listOf(v, max = 20) {
  return Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s.trim()).slice(0, max) : [];
}

const RPL_RULES = `You are the RPL (Recognition of Prior Learning) assessment assistant inside AI StudyMate.

Hard rules:
- This is an AI-ASSISTED PRELIMINARY ASSESSMENT. Never claim to officially certify, qualify, or license anyone.
- Never invent qualifications, employers, dates or skills the candidate did not state.
- Distinguish what the candidate CLAIMS from what uploaded EVIDENCE supports.
- Flag uncertain or unsupported results as needing human verification.
- Never discriminate based on age, gender, religion, caste, language or region. Assess skills only.
- Use respectful, plain language suitable for workers with limited formal education.
- Always respond with ONLY a valid JSON object matching the requested schema.`;

// ---------------------------------------------------------------------------
// Deterministic fallback engine (works with zero AI providers)
// ---------------------------------------------------------------------------

const STOP = new Set(['the', 'and', 'for', 'with', 'have', 'has', 'was', 'were', 'our', 'their', 'from', 'that', 'this', 'years', 'year', 'work', 'worked', 'experience']);

function words(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s&-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

function fallbackSkills(competencies, experience, evidenceNames) {
  const corpus = [experience.text, experience.jobs, experience.training, experience.tools].join(' ');
  const w = words(corpus);
  const ev = evidenceNames.join(' ').toLowerCase();
  return competencies
    .map((c) => {
      const parts = words(c);
      const full = parts.length > 0 && parts.every((t) => w.includes(t));
      const partial = parts.some((t) => w.includes(t));
      const inEvidence = parts.some((t) => ev.includes(t));
      if (!full && !partial && !inEvidence) return null;
      const confidence = full || inEvidence ? 'High confidence' : 'Medium confidence';
      const source = inEvidence ? 'Uploaded evidence + candidate description' : full ? 'Work experience (self-reported)' : 'Possible match in experience description';
      return { name: c, category: /safety|knowledge|principles|reading|awareness|privacy/i.test(c) ? 'Knowledge area' : /communication|service|consultation|handling|reporting|resolution/i.test(c) ? 'Soft skill' : /tools|instruments|machine|software|equipment|systems?|operation/i.test(c) ? 'Tool' : /installation|management|preparation|setup|checking|inspection/i.test(c) ? 'Process' : 'Technical skill', confidence, source };
    })
    .filter(Boolean);
}

function fallbackQuestions(role, competencies, weak, language, count) {
  const langNote = language && language !== 'English' ? ` (language preference: ${language})` : '';
  const langs = ['Electrical Safety', 'Wiring', 'Circuit Installation', 'Fault Diagnosis', 'Maintenance', 'Equipment Handling', 'Tools & Instruments'];
  const picked = (weak.length ? weak : competencies).slice(0, count);
  const types = ['Situational', 'Scenario', 'Technical'];
  const list = picked.map((c, i) => {
    const type = types[i % types.length];
    const base = {
      id: `q${i + 1}`,
      type,
      competency: c,
      difficulty: i === 0 ? 'Beginner' : i < 3 ? 'Intermediate' : 'Advanced',
      prompt: `In your work as a ${role}, describe how you approach ${c.toLowerCase()}: what steps do you follow and what do you check first?${langNote}`,
      options: i % 3 === 2 ? ['Follow the standard safe procedure step by step, checking tools and isolation first', 'Work from memory and fix problems as they appear', 'Copy what other workers do without checking', 'Skip preparation to save time'] : [],
      correctAnswer: i % 3 === 2 ? 0 : -1,
      guidance: `A strong answer describes a safe, systematic approach to ${c} with specific steps and checks.`,
    };
    return base;
  });
  // Guarantee at least one real MCQ per fallback set
  if (!list.some((q) => q.options.length === 4)) {
    list[0] = {
      id: 'q1',
      type: 'Situational',
      competency: list[0].competency,
      difficulty: 'Beginner',
      prompt: `What should you do BEFORE starting work that involves ${list[0].competency.toLowerCase()}?`,
      options: ['Prepare, check tools/equipment, and follow the safe procedure', 'Start immediately and fix problems later', 'Ask a colleague to do it', 'Wait until the end of the day'],
      correctAnswer: 0,
      guidance: 'Preparation and safe procedure come first.',
    };
  }
  return list;
}

function fallbackEvaluation(question, answer) {
  const w = words(answer);
  const guidanceTerms = words(question.guidance || '');
  const matched = guidanceTerms.filter((t) => w.includes(t));
  const coverage = guidanceTerms.length ? matched.length / guidanceTerms.length : 0;
  const lengthScore = Math.min(1, w.length / 40);
  const base = Math.round((coverage * 0.7 + lengthScore * 0.3) * 100);
  const safety = ['safety', 'safe', 'isolate', 'turn off', 'switch off', 'protect', 'careful', 'hazard', 'risk', 'verify', 'check'].filter((t) => (answer || '').toLowerCase().includes(t)).length;
  const knowledge = Math.max(8, Math.min(96, base));
  return {
    competency: question.competency,
    knowledgeEvidence: knowledge,
    practicalReasoning: Math.max(5, Math.min(95, Math.round(base * 0.9 + (w.length > 25 ? 6 : 0)))),
    safetyAwareness: Math.max(10, Math.min(97, 35 + safety * 18)),
    feedback:
      coverage > 0.5
        ? 'Your answer covers the key points an assessor would look for. Adding specific examples from your own work would strengthen the evidence.'
        : 'A stronger answer would describe the key steps and checks in more detail. Think about what an experienced supervisor would look for.',
  };
}

function fallbackReport(payload) {
  const { profile, role, mappings, gaps, readiness, skills } = payload;
  const demonstrated = mappings.filter((m) => m.status === 'Demonstrated');
  const partial = mappings.filter((m) => m.status === 'Partially Demonstrated');
  const notYet = mappings.filter((m) => m.status === 'Evidence Required' || m.status === 'Not Yet Demonstrated');
  const line = (m) => `- ${m.competency}: ${m.status} (evidence: ${m.evidence})`;
  return {
    intro: `Preliminary assessment for ${profile.fullName || 'the candidate'}, targeting ${role} with ${profile.yearsExperience || 'several'} years of experience. This report was generated with AI assistance and is not an official RPL certificate.`,
    sections: [
      {
        heading: '1. Prior Learning Summary',
        body: [
          `The candidate reports ${profile.yearsExperience || 'several'} years of experience as a ${role}${profile.occupation ? ` (current occupation: ${profile.occupation})` : ''}. Education: ${profile.education || 'not specified'}. Location: ${profile.location || 'not specified'}.`,
          'Prior learning includes work experience, informal training and self-learning described by the candidate.',
        ],
      },
      {
        heading: '2. Identified Skills',
        body: skills.length
          ? skills.map((s) => `- ${s.name} (${s.category}, ${s.confidence}) — source: ${s.source}`)
          : ['- No skills could be identified from the information provided.'],
      },
      {
        heading: '3. Competency Mapping',
        body: [
          'Against the occupational competency framework:',
          ...demonstrated.map(line),
          ...partial.map(line),
          ...notYet.map(line),
        ],
      },
      {
        heading: '4. Assessment Performance',
        body: payload.assessmentSummary.answered
          ? [`Answered ${payload.assessmentSummary.answered} of ${payload.assessmentSummary.total} adaptive assessment questions.`]
          : ['The adaptive assessment was not completed.'],
      },
      {
        heading: '5. Skill Gaps',
        body: [
          gaps.demonstrated.length ? `Demonstrated: ${gaps.demonstrated.join(', ')}` : 'Demonstrated: none detected',
          gaps.needsMoreEvidence.length ? `Requiring more evidence: ${gaps.needsMoreEvidence.join(', ')}` : 'Requiring more evidence: none',
          gaps.learningGaps.length ? `Potential learning gaps: ${gaps.learningGaps.join(', ')}` : 'Potential learning gaps: none detected',
        ],
      },
      {
        heading: '6. Evidence Portfolio',
        body: payload.evidence.length ? payload.evidence.map((e) => `- ${e.name} (${e.kind}, status: ${e.status})`) : ['- No evidence items submitted.'],
      },
      {
        heading: '7. RPL Readiness',
        body: [
          `Overall preliminary readiness indicator: ${readiness.overall}%.`,
          `Experience evidence ${readiness.experienceEvidence}%, competency coverage ${readiness.competencyCoverage}%, assessment performance ${readiness.assessmentPerformance}%, evidence completeness ${readiness.evidenceCompleteness}%.`,
          'This is an AI-generated readiness indicator — not an official certification result.',
        ],
      },
      {
        heading: '8. Recommended Next Steps',
        body: [
          notYet.length ? `Submit additional evidence for: ${notYet.map((m) => m.competency).join(', ')}.` : 'Consult an authorized RPL assessor to review this preliminary report.',
          'Complete a practical assessment with an authorized RPL assessor.',
          'Improve identified skill areas through short training or supervised practice.',
        ],
      },
    ],
    nextSteps: [
      'Consult an authorized RPL assessor with this preliminary report.',
      notYet.length ? `Gather more evidence for: ${notYet.map((m) => m.competency).join(', ')}.` : 'Prepare for a practical demonstration of skills.',
      'Consider short skilling courses for the identified learning gaps.',
    ],
    source: 'demo',
    model: 'Built-in assessment engine',
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post('/skills', async (req, res) => {
  const role = str(req.body?.role);
  const competencies = listOf(req.body?.competencies);
  const experience = {
    text: str(req.body?.experience?.text),
    jobs: str(req.body?.experience?.jobs),
    training: str(req.body?.experience?.training),
    tools: str(req.body?.experience?.tools),
  };
  const evidenceNames = listOf(req.body?.evidenceNames, 30);

  if (!role || competencies.length === 0) {
    return res.status(400).json({ error: 'Role and competencies are required.' });
  }

  const userPrompt = `Analyze this candidate for Recognition of Prior Learning (RPL) against the occupation "${role}".

Occupation competency framework: ${competencies.join('; ')}.

Candidate's own description of their experience:
"""
${[experience.text, experience.jobs, experience.training, experience.tools].filter(Boolean).join('\n\n') || '(no description provided)'}
"""

Evidence items uploaded (names only): ${evidenceNames.length ? evidenceNames.join('; ') : 'none'}.

Extract the candidate's skills. Include technical skills, soft skills, tools used, processes performed, knowledge areas and competencies demonstrated. Detect competencies from the framework they show evidence for, and also detect worthwhile skills they mentioned that are NOT in the framework. For every skill, state what supports the detection and be honest about weak support.

Return JSON with EXACTLY this shape:
{
  "skills": array of 5-12 objects: {
    "name": string,
    "category": one of "Technical skill", "Soft skill", "Tool", "Process", "Knowledge area",
    "confidence": one of "High confidence", "Medium confidence", "Needs evidence",
    "source": string explaining exactly what supports this detection, e.g. "Stated in work experience + matches uploaded evidence 'Experience Letter'", or "Candidate claim only — no evidence yet"
  }
}
If support is weak, use confidence "Needs evidence" and say what evidence would confirm it.`;

  try {
    const text = await callLLM(`${RPL_RULES}\n\n${SYSTEM_PROMPT}`, userPrompt);
    const raw = extractJson(text);
    const skills = (Array.isArray(raw?.skills) ? raw.skills : [])
      .map((s) => ({
        name: str(s?.name),
        category: ['Technical skill', 'Soft skill', 'Tool', 'Process', 'Knowledge area'].includes(s?.category) ? s.category : 'Technical skill',
        confidence: ['High confidence', 'Medium confidence', 'Needs evidence'].includes(s?.confidence) ? s.confidence : 'Medium confidence',
        source: str(s?.source, 'Candidate description'),
      }))
      .filter((s) => s.name)
      .slice(0, 14);
    if (skills.length < 3) throw new Error('Too few usable skills extracted');
    res.json({ skills, source: 'ai', model: aiStatus().model });
  } catch (err) {
    console.error('[rpl/skills] AI call failed, using fallback:', err.message);
    res.json({ skills: fallbackSkills(competencies, experience, evidenceNames), source: 'demo', model: 'Built-in assessment engine' });
  }
});

router.post('/questions', async (req, res) => {
  const role = str(req.body?.role);
  const competencies = listOf(req.body?.competencies);
  const weakCompetencies = listOf(req.body?.weakCompetencies);
  const experienceText = str(req.body?.experienceText);
  const language = str(req.body?.language, 'English');

  if (!role || competencies.length === 0) {
    return res.status(400).json({ error: 'Role and competencies are required.' });
  }

  const userPrompt = `Create an adaptive skill assessment for a ${role} candidate for Recognition of Prior Learning (RPL).

Competency framework: ${competencies.join('; ')}.
${weakCompetencies.length ? `Competencies with weaker evidence (prioritize these): ${weakCompetencies.join('; ')}.` : ''}
Candidate's experience summary (use it to personalize experience-based questions):
"""
${experienceText.slice(0, 1200) || '(none provided)'}
"""

Generate 5 questions that TOGETHER cover:
- 2 MCQ (multiple-choice, 4 options, one correct)
- 1 Scenario question (a realistic workplace problem — for a ${role})
- 1 Situational question (what would you do before/during X)
- 1 Experience-based question (ask them to describe something from THEIR OWN work, referencing their description above)

Difficulty: start at Beginner, then Intermediate, then one Advanced question targeting the weakest competency. Questions must be answerable by an experienced practitioner WITHOUT formal education, in plain language.${language !== 'English' ? ` Write the questions in ${language} (keep technical competency names in English).` : ''}

Return JSON with EXACTLY this shape:
{
  "questions": array of exactly 5 objects: {
    "id": "q1"..."q5",
    "type": one of "MCQ", "Scenario", "Situational", "Technical", "Experience-based",
    "competency": string (one of the framework competencies),
    "difficulty": "Beginner" | "Intermediate" | "Advanced",
    "prompt": string,
    "options": array of exactly 4 strings for MCQ / Scenario / Situational (empty array for Experience-based),
    "correctAnswer": integer index 0-3 for MCQ / Scenario / Situational (-1 for Experience-based),
    "guidance": string (what a strong answer must cover — used to evaluate text answers)
  }
}
Scenario/Situational questions must have 4 options with a clearly best answer. Experience-based questions have no options.`;

  try {
    const text = await callLLM(`${RPL_RULES}\n\n${SYSTEM_PROMPT}`, userPrompt);
    const raw = extractJson(text);
    const questions = (Array.isArray(raw?.questions) ? raw.questions : [])
      .map((q, i) => {
        const options = Array.isArray(q?.options) ? q.options.map((o) => String(o)).slice(0, 4) : [];
        const idx = Number(q?.correctAnswer);
        const types = ['MCQ', 'Scenario', 'Situational', 'Technical', 'Experience-based'];
        return {
          id: str(q?.id, `q${i + 1}`),
          type: types.includes(q?.type) ? q.type : 'Technical',
          competency: str(q?.competency, competencies[0]),
          difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(q?.difficulty) ? q.difficulty : 'Intermediate',
          prompt: str(q?.prompt),
          options: options.length === 4 && options.every((o) => o.trim()) ? options : [],
          correctAnswer: options.length === 4 && Number.isInteger(idx) && idx >= 0 && idx <= 3 ? idx : -1,
          guidance: str(q?.guidance),
        };
      })
      .filter((q) => q.prompt)
      .slice(0, 6);
    if (questions.length < 3) throw new Error('Too few usable questions');
    res.json({ questions, source: 'ai', model: aiStatus().model });
  } catch (err) {
    console.error('[rpl/questions] AI call failed, using fallback:', err.message);
    res.json({ questions: fallbackQuestions(role, competencies, weakCompetencies, language, 5), source: 'demo', model: 'Built-in assessment engine' });
  }
});

router.post('/evaluate', async (req, res) => {
  const role = str(req.body?.role);
  const competency = str(req.body?.competency);
  const question = str(req.body?.question);
  const guidance = str(req.body?.guidance);
  const answer = str(req.body?.answer);

  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required.' });
  }

  const userPrompt = `You are evaluating one answer in an RPL preliminary skill assessment for the occupation "${role}".

Competency being assessed: ${competency || 'general'}.
Question (${question.includes('?') ? 'open answer' : 'item'}):
"""
${question}
"""
${guidance ? `A strong answer should cover: ${guidance}` : 'A strong answer should describe practical, safe, systematic steps.'}

Candidate's answer:
"""
${answer}
"""

Evaluate ONLY this answer against the competency criteria. Judge practical understanding, not grammar or vocabulary. Be encouraging. Remember this is a preliminary AI indicator, not a final qualification score.

Return JSON with EXACTLY this shape:
{
  "competency": "${competency || 'general'}",
  "knowledgeEvidence": integer 0-100,
  "practicalReasoning": integer 0-100,
  "safetyAwareness": integer 0-100,
  "feedback": string (2-3 sentences: what the answer showed, what would strengthen it)
}`;

  try {
    const text = await callLLM(`${RPL_RULES}\n\n${SYSTEM_PROMPT}`, userPrompt);
    const raw = extractJson(text);
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const evaluation = {
      competency: str(raw?.competency, competency || 'general'),
      knowledgeEvidence: clamp(raw?.knowledgeEvidence),
      practicalReasoning: clamp(raw?.practicalReasoning),
      safetyAwareness: clamp(raw?.safetyAwareness),
      feedback: str(raw?.feedback, 'Evaluation recorded.'),
    };
    res.json({ evaluation, source: 'ai', model: aiStatus().model });
  } catch (err) {
    console.error('[rpl/evaluate] AI call failed, using fallback:', err.message);
    res.json({ evaluation: fallbackEvaluation({ competency, guidance }, answer), source: 'demo', model: 'Built-in assessment engine' });
  }
});

router.post('/report', async (req, res) => {
  const profile = req.body?.profile && typeof req.body.profile === 'object' ? req.body.profile : {};
  const role = str(req.body?.role);
  const mappings = (Array.isArray(req.body?.mappings) ? req.body.mappings : [])
    .map((m) => ({ competency: str(m?.competency), evidence: str(m?.evidence, 'Not detected'), status: str(m?.status, 'Not Yet Demonstrated') }))
    .filter((m) => m.competency);
  const gaps = {
    demonstrated: listOf(req.body?.gaps?.demonstrated),
    needsMoreEvidence: listOf(req.body?.gaps?.needsMoreEvidence),
    learningGaps: listOf(req.body?.gaps?.learningGaps),
  };
  const readiness = {
    experienceEvidence: Math.max(0, Math.min(100, Math.round(Number(req.body?.readiness?.experienceEvidence) || 0))),
    competencyCoverage: Math.max(0, Math.min(100, Math.round(Number(req.body?.readiness?.competencyCoverage) || 0))),
    assessmentPerformance: Math.max(0, Math.min(100, Math.round(Number(req.body?.readiness?.assessmentPerformance) || 0))),
    evidenceCompleteness: Math.max(0, Math.min(100, Math.round(Number(req.body?.readiness?.evidenceCompleteness) || 0))),
    overall: Math.max(0, Math.min(100, Math.round(Number(req.body?.readiness?.overall) || 0))),
  };
  const skills = (Array.isArray(req.body?.skills) ? req.body.skills : [])
    .map((s) => ({ name: str(s?.name), category: str(s?.category, 'Technical skill'), confidence: str(s?.confidence, 'Medium confidence'), source: str(s?.source) }))
    .filter((s) => s.name);
  const assessmentSummary = {
    answered: Math.max(0, Math.round(Number(req.body?.assessmentSummary?.answered) || 0)),
    total: Math.max(0, Math.round(Number(req.body?.assessmentSummary?.total) || 0)),
  };
  const evidence = (Array.isArray(req.body?.evidence) ? req.body.evidence : [])
    .map((e) => ({ name: str(e?.name), kind: str(e?.kind, 'Other'), status: str(e?.status, 'Uploaded') }));

  if (!role) return res.status(400).json({ error: 'Role is required.' });

  const userPrompt = `Write a professional RPL Skill Assessment Report (preliminary, AI-assisted) for:

Candidate: ${str(profile.fullName) || 'Unnamed candidate'}
Target occupation: ${role}
Experience: ${str(profile.yearsExperience) || 'not stated'} years
Education: ${str(profile.education) || 'not stated'}
Location: ${str(profile.location) || 'not stated'}

Identified skills:
${skills.map((s) => `- ${s.name} (${s.category}, ${s.confidence}) — ${s.source}`).join('\n') || '- none'}

Competency mapping:
${mappings.map((m) => `- ${m.competency}: ${m.status} (evidence: ${m.evidence})`).join('\n') || '- none'}

Skill gaps — demonstrated: ${gaps.demonstrated.join(', ') || 'none'}; needs more evidence: ${gaps.needsMoreEvidence.join(', ') || 'none'}; learning gaps: ${gaps.learningGaps.join(', ') || 'none'}.
Readiness breakdown: overall ${readiness.overall}%, experience evidence ${readiness.experienceEvidence}%, competency coverage ${readiness.competencyCoverage}%, assessment performance ${readiness.assessmentPerformance}%, evidence completeness ${readiness.evidenceCompleteness}%.
Assessment: answered ${assessmentSummary.answered}/${assessmentSummary.total} questions.
Evidence portfolio: ${evidence.map((e) => `${e.name} (${e.kind}, ${e.status})`).join('; ') || 'none submitted'}.

Write it in clear professional English that a worker with limited formal education can still follow. Sections must exactly follow the numbered structure below. The report must clearly present itself as an AI-assisted preliminary assessment — never as an official certificate.

Return JSON with EXACTLY this shape:
{
  "intro": string (2-3 sentences summarizing who is being assessed and the preliminary nature of the report),
  "sections": array of exactly 8 objects: {
    "heading": one of "1. Prior Learning Summary", "2. Identified Skills", "3. Competency Mapping", "4. Assessment Performance", "5. Skill Gaps", "6. Evidence Portfolio", "7. RPL Readiness", "8. Recommended Next Steps",
    "body": array of strings (bullet-style lines; use the data above; do NOT invent facts)
  },
  "nextSteps": array of 3-4 short strings (concrete, respectful next steps such as consulting an authorized RPL assessor, gathering specific evidence, practical assessment)
}`;

  try {
    const text = await callLLM(`${RPL_RULES}\n\n${SYSTEM_PROMPT}`, userPrompt);
    const raw = extractJson(text);
    const sections = (Array.isArray(raw?.sections) ? raw.sections : [])
      .map((s) => ({ heading: str(s?.heading), body: listOf(s?.body, 15).map(String) }))
      .filter((s) => s.heading && s.body.length > 0);
    if (sections.length < 5) throw new Error('Too few report sections');
    const report = {
      intro: str(raw?.intro, 'AI-assisted preliminary assessment.'),
      sections,
      nextSteps: listOf(raw?.nextSteps, 5).map(String).length ? listOf(raw.nextSteps, 5).map(String) : ['Consult an authorized RPL assessor with this preliminary report.'],
      source: 'ai',
      model: aiStatus().model,
    };
    res.json({ report });
  } catch (err) {
    console.error('[rpl/report] AI call failed, using fallback:', err.message);
    res.json({ report: fallbackReport({ profile, role, mappings, gaps, readiness, skills, assessmentSummary, evidence }) });
  }
});

router.post('/assistant', async (req, res) => {
  const question = str(req.body?.question);
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};

  if (!question) return res.status(400).json({ error: 'Ask the assistant a question.' });

  const userPrompt = `A candidate is using the RPL skill assessment tool and asks the RPL Assistant:
"""
${question}
"""

Their current assessment context (may be partial):
- Target occupation: ${str(context.role) || 'not selected yet'}
- Years of experience: ${str(context.yearsExperience) || 'not stated'}
- Top identified skills: ${listOf(context.topSkills, 8).join(', ') || 'not yet analyzed'}
- Identified gaps: ${listOf(context.gaps, 8).join(', ') || 'none yet'}
- Preliminary readiness: ${typeof context.readiness === 'number' ? `${context.readiness}%` : 'not yet calculated'}

Answer helpfully in plain language (short paragraphs or a compact list). Explain what RPL is, what evidence helps, or what their results mean — whichever they asked about. Use their context where it helps. Never promise official certification or government approval; if they ask about official recognition, explain that final decisions belong to authorized RPL assessment bodies and this tool only provides an AI-assisted preliminary assessment.

Return JSON with EXACTLY this shape:
{
  "answer": string (your full answer, using \\n for line breaks)
}`;

  try {
    const text = await callLLM(`${RPL_RULES}\n\n${SYSTEM_PROMPT}`, userPrompt);
    const raw = extractJson(text);
    const answer = str(raw?.answer);
    if (!answer) throw new Error('Empty answer');
    res.json({ answer, source: 'ai', model: aiStatus().model });
  } catch (err) {
    console.error('[rpl/assistant] AI call failed, using fallback:', err.message);
    res.json({ answer: fallbackAssistantAnswer(question, context), source: 'demo', model: 'Built-in assessment engine' });
  }
});

function fallbackAssistantAnswer(question, context) {
  const q = question.toLowerCase();
  const role = str(context.role) || 'your occupation';
  if (/what is rpl|recognition of prior/.test(q)) {
    return 'RPL (Recognition of Prior Learning) is a process where skills you learned through work experience, informal training or self-study are formally assessed and can count toward a qualification — even if you never studied it in a classroom.\n\nIn this tool, AI helps with the FIRST step only: an AI-assisted preliminary assessment that maps your experience against your occupation\'s competency framework, so you know what you can already demonstrate and where you need more evidence.\n\nThe final RPL decision always belongs to an authorized RPL assessment body or assessor.';
  }
  if (/evidence|document|submit/.test(q)) {
    return 'Useful RPL evidence includes:\n\n• Certificates or marksheets from any training\n• Experience letters from employers or contractors\n• Photos or videos of your work (e.g. installations you completed)\n• Project documentation or work records\n• Examples of your work (portfolio)\n\nIn this tool, file contents stay on your device — you record what each document is, and it gets mapped to your skills. Evidence marked "Requires Human Verification" should be shown to an authorized assessor later.';
  }
  if (/gap|weak|improve|prepare/.test(q)) {
    const gaps = listOf(context.gaps, 6);
    return `Your skill gap analysis shows where more evidence or practice would help${gaps.length ? `: ${gaps.join(', ')}` : ''}.\n\nTo prepare:\n1. Gather documents or photos that demonstrate those competencies.\n2. Practice explaining your step-by-step process out loud — assessors ask for it.\n3. If a gap is a genuine skill gap, a short course or supervised practice closes it.\n\nThe assessment performance part of your readiness reflects how you answered the adaptive questions.`;
  }
  if (/certificat|official|government|valid/.test(q)) {
    return 'Important: this tool provides an AI-assisted PRELIMINARY assessment only. It does not issue official certificates, and no percentage here guarantees RPL certification.\n\nOfficial recognition comes from authorized RPL assessment bodies (for example, sector skill councils and their approved assessors). Use your report as preparation and evidence organization for that process.';
  }
  if (/skill|competenc|require/.test(q)) {
    return `For ${role}, the competency framework covers the practical areas an experienced practitioner is expected to handle. Your assessment maps what you described against those competencies.\n\nCompetencies marked "Demonstrated" have support in your experience or evidence. "Partially Demonstrated" or "Evidence Required" means an assessor would want more proof or a practical demonstration.`;
  }
  if (/assess|happen|process|how does/.test(q)) {
    return 'During an RPL assessment, an authorized assessor typically: reviews your evidence, checks your experience claims, asks questions or observes a practical demonstration, and maps everything against the occupation\'s competency framework.\n\nIn this tool you practice exactly that mapping first: profile → experience → evidence → AI skill analysis → competency mapping → adaptive questions → gap analysis → readiness report. It prepares you for the real assessment without replacing it.';
  }
  return `I can help with questions about RPL, evidence, competency mapping, your skill gaps or how the assessment works. Right now I'm running on the built-in offline assistant — live AI answers resume automatically when the AI service is reachable.\n\nFor ${role}, your next step is usually: finish the assessment steps, review your skill gap analysis, and prepare the evidence listed there before seeing an authorized RPL assessor.`;
}

export default router;
