/**
 * SKILLFORGE AI — AI layer for the adaptive job simulation.
 *
 * The AI does ONLY what it is good at and nothing more:
 *   1. Re-skin curated scenarios (fresh customer reports, symptoms, live data)
 *      WITHOUT touching actions, branching or safety rules.
 *   2. Interpret free-text/voice candidate responses and map them to the
 *      curated action set (matching is still validated server-side).
 *   3. Enrich micro-bridge concepts with technician-voice content.
 *
 * The AI NEVER: runs the state machine, judges safety, sets difficulty,
 * overrides rules, or issues scores. Those are deterministic (src/forge/engine.ts).
 */

import { Router } from 'express';
import { callLLM, callVision, extractJson, aiStatus } from './ai.js';

const router = Router();

function str(v, fallback = '') {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

// ---------------------------------------------------------------------------
// 1. Scenario reskin — presentation only.
// ---------------------------------------------------------------------------

router.post('/scenario', async (req, res) => {
  const {
    scenarioId,
    competency,
    occupationName,
    level,
    variation,
    customerReport,
    systemData,
    prompt,
    curatedFallback,
  } = req.body ?? {};

  if (!scenarioId || !variation) {
    return res.status(400).json({ error: 'scenarioId and variation are required.' });
  }

  const VARIATIONS = {
    'stress-symptom': 'a different practical trigger for the SAME fault pattern (weather, load, trip length, road conditions)',
    'misleading-customer': 'a customer whose confident self-diagnosis points at the WRONG component',
    'prior-work': 'an earlier repair by someone else that complicates the picture',
  };
  const variationText = VARIATIONS[variation] ?? VARIATIONS['stress-symptom'];

  const system = `You are the scenario renderer inside SKILLFORGE, an AI job-simulation platform for workforce skill assessment.
You re-skin expert-defined job scenarios. You NEVER change the technical decision logic, the available actions, or any safety procedure — those are fixed by occupational experts.
You NEVER invent technical standards, values outside plausible ranges for the given readings, or new fault mechanisms.
Write like a real Indian two-wheeler EV service context. Keep language simple and concrete (many candidates have limited formal literacy).`;
  const user = `Re-skin this ${occupationName} job scenario (difficulty level ${level}, competency: ${competency}).

Original customer report: ${customerReport}
Original live data: ${JSON.stringify(systemData)}
Original prompt: ${prompt}

Variation to apply: ${variationText}.

Return ONLY JSON:
{
  "customerReport": string (2-4 sentences, first-person customer voice, realistic, ${variationText}),
  "systemData": array of 4-6 objects { "label": string, "value": string, "status": "ok" | "warn" | "alert" | "idle" } (plausible values consistent with the original data and the variation),
  "prompt": string (the decision prompt, one sentence, simple words)
}`;

  try {
    const text = await callLLM(system, user);
    const raw = extractJson(text);
    const data = Array.isArray(raw.systemData)
      ? raw.systemData
          .filter((d) => d && str(d.label) && str(d.value))
          .slice(0, 6)
          .map((d) => ({
            label: str(d.label),
            value: str(d.value),
            status: ['ok', 'warn', 'alert', 'idle'].includes(d.status) ? d.status : 'ok',
          }))
      : [];
    if (!str(raw.customerReport) || data.length < 3) throw new Error('Malformed reskin');
    res.json({
      source: 'ai',
      model: aiStatus().model,
      title: undefined,
      customerReport: str(raw.customerReport),
      systemData: data,
      prompt: str(raw.prompt, str(prompt)),
      note: 'AI-generated variation — same competency, same decision logic, new presentation.',
    });
  } catch (err) {
    console.error('[forge/scenario] AI failed, using curated fallback:', err.message);
    res.json({ source: 'curated', ...(curatedFallback ?? {}) });
  }
});

// ---------------------------------------------------------------------------
// 2. Free-text action interpretation (voice / typing input).
// ---------------------------------------------------------------------------

router.post('/interpret', async (req, res) => {
  const { transcript, actions, scenarioTitle, prompt } = req.body ?? {};
  const actionList = Array.isArray(actions) ? actions : [];

  if (!str(transcript) || actionList.length === 0) {
    return res.status(400).json({ error: 'transcript and actions are required.' });
  }

  const system = `You map a job candidate's spoken or typed response to the closest predefined action in a job simulation. You do NOT judge whether the action is correct — you only match intent. If no action plausibly matches, return -1.`;
  const user = `Job scenario: "${str(scenarioTitle)}"
Prompt to the candidate: "${str(prompt)}"

Available actions:
${actionList.map((a, i) => `${i}: ${a}`).join('\n')}

Candidate said: "${str(transcript)}"

Return ONLY JSON:
{ "index": integer (-1 to ${actionList.length - 1}), "confidence": "high" | "medium" | "low", "quote": string (the short phrase in the transcript that matched) }`;

  try {
    const text = await callLLM(system, user);
    const raw = extractJson(text);
    const idx = Number(raw.index);
    const index = Number.isInteger(idx) && idx >= -1 && idx < actionList.length ? idx : -1;
    res.json({
      source: 'ai',
      index,
      confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'low',
      quote: str(raw.quote),
    });
  } catch (err) {
    console.error('[forge/interpret] AI failed, using keyword fallback:', err.message);
    // Deterministic keyword fallback — decent matching without the LLM.
    const t = str(transcript).toLowerCase();
    let best = { index: -1, score: 0 };
    actionList.forEach((label, i) => {
      const words = String(label).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
      if (score > best.score) best = { index: i, score };
    });
    res.json({ source: 'fallback', index: best.score > 0 ? best.index : -1, confidence: 'low', quote: '' });
  }
});

// ---------------------------------------------------------------------------
// 3. Micro-bridge concept enrichment — technician-voice content.
// ---------------------------------------------------------------------------

router.post('/micro-bridge', async (req, res) => {
  const { competencyName, competencyDescription, conceptTitle, bullets, coachTip } = req.body ?? {};
  if (!str(competencyName) || !str(conceptTitle)) {
    return res.status(400).json({ error: 'competencyName and conceptTitle are required.' });
  }

  const system = `You write short, practical micro-learning content for frontline technicians inside SKILLFORGE, an AI job-simulation platform. You enrich expert-defined concepts — you do NOT invent new technical standards, values or procedures. Simple words, concrete examples, respectful tone for working professionals.`;
  const user = `Enrich this micro-bridge concept for the competency "${str(competencyName)}" (${str(competencyDescription)}).

Expert-defined concept title: "${str(conceptTitle)}"
Expert-defined key points:
${(Array.isArray(bullets) ? bullets : []).map((b) => `- ${b}`).join('\n')}
Coach tip: ${str(coachTip)}

Return ONLY JSON:
{
  "title": string (the concept title, polished),
  "bullets": array of 4-6 strings (each 1-2 sentences, expanding each expert key point with a concrete workshop example; keep every expert point, add no new standards),
  "coachTip": string (one punchy sentence a senior technician would actually say)
}`;

  try {
    const text = await callLLM(system, user);
    const raw = extractJson(text);
    const outBullets = (Array.isArray(raw.bullets) ? raw.bullets : []).map((b) => str(b)).filter(Boolean).slice(0, 6);
    if (outBullets.length < 3) throw new Error('Malformed micro-bridge content');
    res.json({
      source: 'ai',
      title: str(raw.title, str(conceptTitle)),
      bullets: outBullets,
      coachTip: str(raw.coachTip, str(coachTip)),
    });
  } catch (err) {
    console.error('[forge/micro-bridge] AI failed, using curated fallback:', err.message);
    res.json({ source: 'curated', title: str(conceptTitle), bullets: Array.isArray(bullets) ? bullets : [], coachTip: str(coachTip) });
  }
});

// ---------------------------------------------------------------------------
// 4. SkillVision — workspace camera frames → AI OBSERVATIONS.
//
// Frames are analysed by the configured multimodal provider (Gemini). The
// output is strictly descriptive: what the AI saw in the workspace, tagged
// with per-observation confidence. It NEVER certifies, scores or decides —
// observations are evidence hints for the human assessor.
// ---------------------------------------------------------------------------

const KINDS = new Set(['safety', 'skill', 'cleanup', 'note']);

router.post('/vision', async (req, res) => {
  const { scenarioId, competency, nodePrompt, frames } = req.body ?? {};
  if (!Array.isArray(frames) || frames.length === 0) {
    return res.status(400).json({ error: 'frames array is required.' });
  }
  const validFrames = frames.filter((f) => typeof f === 'string' && /^data:image\/(jpeg|jpg|png);base64,/.test(String(f).slice(0, 64)));
  if (validFrames.length === 0) {
    return res.status(400).json({ error: 'No decodable image frames provided.' });
  }

  const system = `You are SkillVision, the workspace-observation layer of SKILLFORGE, an AI job-simulation skill platform.
You watch short frame sequences of a technician's REAL workspace or hands-on equipment and describe what you observe.
STRICT RULES:
- Describe only what is visible in the frames. If the person or equipment is unclear, say so plainly.
- Assign each observation a kind: "safety" (PPE, isolation, procedures), "skill" (technique, tool handling, ordered workflow), "cleanup" (worksite restoration, tidying), or "note" (anything else relevant).
- Where a competency id fits, map it to: ${str(competency, 'general workmanship')}.
- NEVER certify, score, grade or decide anything. You generate OBSERVATIONS ONLY. Confidence per observation is your honest uncertainty, a number between 0 and 1.
- Assume the frames are of a real worker. Be respectful, concrete and specific.`;
  const user = `Scenario: ${str(scenarioId)} (competency ${str(competency)}). On-screen prompt was: "${str(nodePrompt)}".

The attached ${validFrames.length} JPEG frames show a technician's workspace, captured about a second apart.
Return ONLY JSON:
{
  "summary": string (1-2 sentences, what the workspace/person appears to be doing overall),
  "observations": [
    { "label": string (short noun phrase, max 6 words),
      "kind": "safety" | "skill" | "cleanup" | "note",
      "competency": string (best-fit competency id or ""),
      "detail": string (one concrete sentence about what is visible),
      "confidence": number (0-1) }
  ] (2-5 items)
}`;

  try {
    const { text, model } = await callVision(system, user, validFrames);
    const raw = extractJson(text);
    const observations = (Array.isArray(raw.observations) ? raw.observations : [])
      .map((o) => ({
        label: str(o?.label, 'Observation'),
        kind: KINDS.has(o?.kind) ? o.kind : 'note',
        competency: str(o?.competency) || undefined,
        detail: str(o?.detail),
        confidence: Math.max(0, Math.min(1, Number(o?.confidence) || 0.5)),
      }))
      .filter((o) => o.detail)
      .slice(0, 5);
    if (observations.length < 1) throw new Error('Malformed vision observations');
    res.json({
      source: 'ai',
      model,
      summary: str(raw.summary, 'Workspace frames analysed.'),
      observations,
    });
  } catch (err) {
    console.error('[forge/vision] AI vision failed:', err.message);
    // Honest fallback: the platform never pretends the camera saw something.
    res.json({
      source: 'unavailable',
      summary: 'AI vision is not available right now (no vision provider configured or the call failed). Decision-based assessment continues fully without it.',
      observations: [],
    });
  }
});

export default router;
