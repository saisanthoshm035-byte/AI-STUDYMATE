// SKILLFORGE AI — client API layer. Additive to the existing StudyMate API.

export interface ForgeReskin {
  source: 'ai' | 'curated';
  customerReport: string;
  systemData: { label: string; value: string; status: 'ok' | 'warn' | 'alert' | 'idle' }[];
  prompt: string;
  note?: string;
}

export interface ForgeInterpretation {
  source: 'ai' | 'fallback';
  index: number;
  confidence: 'high' | 'medium' | 'low';
  quote: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/forge${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Forge API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const forgeApi = {
  /** Re-skin a curated scenario. Falls back to the curated variation server-side. */
  reskin: (payload: {
    scenarioId: string;
    competency: string;
    occupationName: string;
    level: number;
    variation: string;
    customerReport: string;
    systemData: { label: string; value: string; status: string }[];
    prompt: string;
    curatedFallback: { customerReport: string; systemData: { label: string; value: string; status: string }[]; prompt: string; note?: string };
  }) => post<ForgeReskin>('/scenario', payload),

  /** Map free text / voice transcript onto a curated action index. */
  interpret: (payload: { transcript: string; actions: string[]; scenarioTitle: string; prompt: string }) =>
    post<ForgeInterpretation>('/interpret', payload),

  /** Enrich a micro-bridge concept (falls back to the curated content server-side). */
  microBridge: (payload: {
    competencyName: string;
    competencyDescription: string;
    conceptTitle: string;
    bullets: string[];
    coachTip: string;
  }) => post<{ source: 'ai' | 'curated'; title: string; bullets: string[]; coachTip: string }>('/micro-bridge', payload),
};
