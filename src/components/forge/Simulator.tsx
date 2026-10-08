// ---------------------------------------------------------------------------
// SKILLFORGE AI — Job Simulation screen. The operational interface: customer
// report, live system data, available tools, decision. NOT a form.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, Mic, MicOff, Play, ShieldAlert,
  Volume2, Wrench,
} from 'lucide-react';
import { applyAction, advance, currentNode, getLiveSystemData, safetyChecklist } from '../../forge/engine';
import { forgeApi } from '../../forge/api';
import { listenOnce, speak, speechSupport, stopSpeaking, type RecognitionLang } from '../../lib/forgeSpeech';
import type { ForgeSession } from '../../forge/types';
import type { ActionResponse } from '../../forge/engine';

interface SimulatorProps {
  session: ForgeSession;
  /** AI reskin the app already fetched for the current node (null = use curated). */
  reskin: ReskinState | null;
  onSessionChange: (s: ForgeSession) => void;
  onActionApplied: (s: ForgeSession, response: ActionResponse) => void;
  onExit: () => void;
}

export interface ReskinState {
  variation: string;
  customerReport: string;
  systemData: { label: string; value: string; status: 'ok' | 'warn' | 'alert' | 'idle' }[];
  prompt: string;
  source: 'ai' | 'curated';
  note?: string;
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  alert: 'text-red-300',
  idle: 'text-slate-400',
};

const LEVEL_TAG = ['', 'LEVEL 1 · BASIC', 'LEVEL 2 · MULTI-CAUSE', 'LEVEL 3 · INTERMITTENT', 'LEVEL 4 · CONFLICTING EVIDENCE', 'LEVEL 5 · SAFETY-CRITICAL', 'LEVEL 6 · COMPLICATION'];

export default function Simulator({ session, reskin, onSessionChange, onActionApplied, onExit }: SimulatorProps) {
  const node = currentNode(session);
  const [pending, setPending] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ActionResponse | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<RecognitionLang>('en-IN');
  const handleRef = useRef<{ stop: () => void } | null>(null);
  const support = speechSupport();

  const liveData = reskin?.systemData?.length ? reskin.systemData : getLiveSystemData(node, session);
  const customerReport = reskin?.customerReport ?? node.customerReport;
  const prompt = reskin?.prompt ?? node.prompt;

  // Read the prompt aloud once per scenario (voice-first support).
  useEffect(() => {
    setLastResponse(null);
    setVoiceText('');
    return () => stopSpeaking();
  }, [node.id]);

  const onAction = useCallback(
    (actionId: string) => {
      if (pending || session.ended) return;
      setPending(actionId);
      // Async IIFE pattern (browser-friendly): brief delay so the selection registers.
      void (async () => {
        await new Promise((r) => setTimeout(r, 350));
        const { session: next, response } = applyAction(session, actionId);
        setLastResponse(response);
        onActionApplied(next, response);
        await new Promise((r) => setTimeout(r, 450));
        const advanced = advance(next, response.nextNodeId);
        onSessionChange(advanced);
        setPending(null);
      })();
    },
    [pending, session, onActionApplied, onSessionChange],
  );

  const startListening = useCallback(() => {
    setVoiceError(null);
    setVoiceText('');
    handleRef.current?.stop();
    handleRef.current = listenOnce({
      lang: voiceLang,
      onPartial: (t) => setVoiceText(t),
      onResult: (t) => {
        setVoiceText(t);
        setListening(false);
        void (async () => {
          setPending('voice');
          try {
            const interp = await forgeApi.interpret({
              transcript: t,
              actions: node.actions.map((a) => a.label),
              scenarioTitle: node.title,
              prompt,
            });
            if (interp.index >= 0) {
              const action = node.actions[interp.index];
              setVoiceText(`${t} → ${action.label}`);
              setTimeout(() => onAction(action.id), 500);
            } else {
              setVoiceError('Could not match that to an action — pick from the buttons below.');
              setPending(null);
            }
          } catch {
            setVoiceError('Voice matching failed — pick from the buttons below.');
            setPending(null);
          }
        })();
      },
      onError: (e) => {
        setVoiceError(e === 'not-allowed' ? 'Microphone access was blocked. You can type or tap instead.' : e);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (handleRef.current) setListening(true);
  }, [voiceLang, node, prompt, onAction]);

  const toggleVoice = useCallback(() => {
    if (listening) {
      handleRef.current?.stop();
      setListening(false);
    } else {
      startListening();
    }
  }, [listening, startListening]);

  const done =
    session.ended ||
    (lastResponse !== null &&
      lastResponse.nextNodeId !== 'stay' &&
      (lastResponse.nextNodeId === null ||
        (session.currentNodeId !== node.id && lastResponse.nextNodeId !== 'adaptive')));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6" data-testid="forge-simulator">
      {/* ---------------- top bar ---------------- */}
      <div className="sf-glass flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="sf-live-dot" aria-hidden="true" />
          <div>
            <div className="font-display text-sm font-extrabold tracking-wide text-white">EV TECHNICIAN SIMULATION</div>
            <div className="text-[11px] text-slate-400">DEMO OCCUPATION · SkillForge AI adaptive job simulation</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="sf-chip sf-chip-good">{LEVEL_TAG[node.level] ?? `LEVEL ${node.level}`}</span>
          <span className="sf-chip">Step {session.step}</span>
          <button onClick={onExit} className="sf-btn-ghost btn btn-sm px-3 py-1.5 text-xs">Save & exit</button>
        </div>
      </div>

      {/* ---------------- safety checklist (when relevant) ---------------- */}
      {session.safetyViolations.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <div className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" aria-hidden="true" /> DETERMINISTIC SAFETY FLAG</div>
          <p className="mt-1 text-xs">{session.safetyViolations[session.safetyViolations.length - 1].ruleName} was skipped. This flag is a fixed rule — the AI cannot overturn it, and neither can a retry.</p>
        </div>
      )}

      {/* ---------------- customer report + live data ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="sf-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xs font-bold tracking-[0.12em] text-slate-400">CUSTOMER REPORT</h2>
            <button
              onClick={() => speak(customerReport, voiceLang === 'ta-IN' ? 'ta-IN' : 'en-IN')}
              className="sf-chip cursor-pointer"
              aria-label="Read the customer report aloud"
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Listen
            </button>
          </div>
          <p className="mt-3 font-display text-lg leading-relaxed text-white">{customerReport}</p>
          <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-2.5">
            <div className="text-[11px] font-bold tracking-wider text-slate-400">WORK ORDER · {node.title}</div>
          </div>
        </div>

        <div className="sf-card p-5">
          <h2 className="font-display text-xs font-bold tracking-[0.12em] text-slate-400">LIVE SYSTEM DATA</h2>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {liveData.map((d) => (
              <div key={d.label} className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{d.label}</div>
                <div className={`font-display text-sm font-bold ${STATUS_STYLE[d.status] ?? 'text-slate-300'}`}>{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- safety chain progress ---------------- */}
      {(node.actions.some((a) => a.completes?.length || a.requires?.length)) && (
        <div className="mt-4 sf-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold tracking-wider text-slate-400">HV SAFETY CHAIN:</span>
            {safetyChecklist(session).map(({ rule, done: ruleDone }) => (
              <span key={rule.id} className={`sf-chip ${ruleDone ? 'sf-chip-good' : ''}`}>
                {ruleDone ? '✓' : '○'} {rule.name.split('&')[0].trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- system response ---------------- */}
      {lastResponse && (
        <div
          data-testid="forge-response"
          className={`mt-4 rounded-xl border px-4 py-3.5 ${
            lastResponse.kind === 'safety-violation'
              ? 'border-red-400/50 bg-red-500/10'
              : lastResponse.verdict === 'correct'
                ? 'border-emerald-400/40 bg-emerald-500/10'
                : 'border-amber-400/40 bg-amber-500/10'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold tracking-wide">
            {lastResponse.kind === 'safety-violation' ? (
              <><ShieldAlert className="h-4 w-4 text-red-300" aria-hidden="true" /> SYSTEM — SAFETY GATE BLOCKED THE ACTION</>
            ) : lastResponse.verdict === 'correct' ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" /> SYSTEM RESPONSE</>
            ) : (
              <><AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" /> SYSTEM RESPONSE</>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{lastResponse.text}</p>
          {lastResponse.capabilities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lastResponse.capabilities.map((c) => (
                <span key={c} className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-200">+ {c}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- the decision ---------------- */}
      {!done && (
        <div className="mt-4 sf-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-extrabold text-white">{prompt}</h2>
            <div className="flex items-center gap-2">
              {support.recognition && (
                <>
                  <select
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value as RecognitionLang)}
                    className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-300"
                    aria-label="Voice language"
                  >
                    <option value="en-IN">🇬🇧 English</option>
                    <option value="ta-IN">🇮🇳 தமிழ்</option>
                  </select>
                  <button
                    onClick={toggleVoice}
                    className={`btn ${listening ? 'btn-primary' : 'sf-btn-ghost'} btn-md`}
                    aria-label={listening ? 'Stop listening' : 'Answer by voice'}
                  >
                    {listening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                    {listening ? 'Listening…' : 'Speak'}
                  </button>
                </>
              )}
            </div>
          </div>

          {(voiceText || voiceError) && (
            <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3.5 py-2.5 text-sm text-slate-300">
              {voiceText && <span>🎙️ “{voiceText}”</span>}
              {voiceError && <span className={voiceText ? 'block pt-1 text-amber-300' : 'text-amber-300'}>{voiceError}</span>}
            </div>
          )}

          <div className="mt-4 grid gap-2.5">
            {node.actions.map((a) => (
              <button
                key={a.id}
                onClick={() => onAction(a.id)}
                disabled={pending !== null}
                data-testid={`forge-action-${a.id}`}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  pending === a.id
                    ? 'border-cyan-400/60 bg-cyan-500/15'
                    : 'border-slate-700/70 bg-slate-800/40 hover:border-cyan-400/50 hover:bg-slate-800/70'
                } disabled:opacity-60`}
              >
                <span className="text-xl" aria-hidden="true">{a.icon}</span>
                <span className="flex-1 text-sm font-semibold text-slate-100">{a.label}</span>
                {a.completes?.length ? <Wrench className="h-4 w-4 text-emerald-300" aria-hidden="true" /> : null}
                <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-700/50 pt-3">
            <span className="text-[11px] font-bold tracking-wider text-slate-500">TOOLS AVAILABLE:</span>
            {node.tools.map((t) => (
              <span key={t.id} className="sf-chip">{t.icon} {t.label}</span>
            ))}
          </div>
        </div>
      )}

      {pending === 'voice' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Play className="h-4 w-4 animate-pulse" aria-hidden="true" /> Matching your words to an action…
        </div>
      )}
    </div>
  );
}
