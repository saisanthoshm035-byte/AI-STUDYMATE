// ---------------------------------------------------------------------------
// SKILLFORGE AI — SkillVision.
//
// "SHOW CAPABILITY THROUGH ACTION" taken literally: the candidate points a
// webcam at their REAL workspace (or their hands on real equipment) and the AI
// watches the capture — no long forms, no literacy barrier. Frames are grabbed
// on-device from getUserMedia, JPEG-compressed locally, and analysed server-
// side by the configured multimodal provider. The AI NEVER certifies and its
// observations are always shown as "what the AI saw" — not as a verdict.
//
// Guardrails:
//   • frames are captured only after the candidate presses the button
//   • only compressed JPEG frames leave the device (never the raw stream)
//   • observations are labelled with per-item AI confidence and can be wrong;
//     they are CASIMIR evidence hints for the human assessor, not decisions
// ---------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react';
import { Camera, Eye, Loader2, ShieldAlert } from 'lucide-react';
import { forgeApi } from '../../forge/api';
import type { VisionAnalysis } from '../../forge/types';

interface SkillVisionProps {
  scenarioId: string;
  competency: string;
  nodePrompt: string;
  variant?: 'card' | 'compact';
}

const KIND_CHIP: Record<string, string> = {
  safety: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  skill: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
  cleanup: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  note: 'border-slate-600/60 bg-slate-800/40 text-slate-300',
};

/** Grab N downsampled JPEG frames from a video element, data URLs. */
function grabFrames(video: HTMLVideoElement, count: number): string[] {
  const frames: string[] = [];
  const w = 480;
  const h = Math.max(1, Math.round((video.videoHeight || 360) * (w / (video.videoWidth || 640))));
  for (let i = 0; i < count; i++) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) break;
    ctx.drawImage(video, 0, 0, w, h);
    frames.push(c.toDataURL('image/jpeg', 0.6));
  }
  return frames;
}

export default function SkillVision({ scenarioId, competency, nodePrompt, variant = 'card' }: SkillVisionProps) {
  const [scanning, setScanning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'camera' | 'analyzing' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startAndCapture = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      // Some environments need a user-initiated await before getUserMedia.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640 }, audio: false });
      streamRef.current = stream;
      setPhase('camera');
      await new Promise<void>((resolve) => {
        const v = document.createElement('video');
        v.muted = true;
        v.srcObject = stream;
        videoRef.current = v;
        v.onloadedmetadata = () => {
          void v.play();
          // Brief settle so the candidate frames their workspace.
          void new Promise((r) => setTimeout(r, 1200)).then(() => resolve());
        };
        // If metadata never loads (headless / denied preview), still resolve.
        setTimeout(resolve, 4000);
      });
      const v = videoRef.current;
      if (!v || !v.videoWidth) throw new Error('CAMERA_UNAVAILABLE');
      setPhase('analyzing');
      const frames = grabFrames(v, 3);
      const result = await forgeApi.vision({ scenarioId, competency, nodePrompt, frames });
      setAnalysis({
        source: result.source,
        model: result.model,
        summary: result.summary,
        observations: result.observations.map((o) => ({
          label: o.label,
          kind: (['safety', 'skill', 'cleanup', 'note'].includes(o.kind) ? o.kind : 'note') as VisionAnalysis['observations'][number]['kind'],
          competency: o.competency,
          detail: o.detail,
          confidence: o.confidence,
        })),
      });
      setPhase('done');
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'CAMERA_UNAVAILABLE'
          ? 'Camera not available in this browser/kiosk. SkillVision needs a real webcam — the decision-based simulation still works fully without it.'
          : 'SkillVision capture failed. The simulation continues without camera evidence.',
      );
      setPhase('idle');
    } finally {
      stopCamera();
      setScanning(false);
    }
  }, [competency, nodePrompt, scenarioId, stopCamera]);

  const compact = variant === 'compact';

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-cyan-400/25 bg-slate-900/50 p-3'
          : 'sf-card mt-4 p-4'
      }
      data-testid="forge-skillvision"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-cyan-300">
          <Eye className="h-4 w-4" aria-hidden="true" /> SKILLVISION · WORKSPACE CAMERA
        </div>
        <button
          onClick={startAndCapture}
          disabled={scanning}
          className={`btn ${compact ? 'btn-sm' : 'sf-btn-ghost btn-sm'} px-3 py-1.5 text-xs`}
          data-testid="forge-skillvision-capture"
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Camera className="h-3.5 w-3.5" aria-hidden="true" />}
          {phase === 'idle' ? 'Watch my work' : scanning ? 'Capturing…' : 'Capture again'}
        </button>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
        Point your camera at your hands or your equipment and press capture. The AI watches <em>what you do</em> — no reading,
        no forms. Frames leave the device only when you press the button, and the AI can only <em>observe</em>: its notes are
        hints for the human assessor, never a certificate.
      </p>

      {phase === 'camera' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
          <span className="sf-live-dot" aria-hidden="true" /> Camera live — hold steady… capture is automatic.
        </div>
      )}
      {phase === 'analyzing' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-cyan-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> AI analysing your workspace…
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" /> {error}
        </div>
      )}

      {analysis && (
        <div data-testid="forge-skillvision-result" className="mt-3">
          <p className="text-sm text-slate-200">{analysis.summary}</p>
          {analysis.model && (
            <div className="mt-1 text-[10px] text-slate-500">analysed by {analysis.model} · observations only, never a verdict</div>
          )}
          <div className="mt-2 space-y-1.5">
            {analysis.observations.map((o, i) => (
              <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${KIND_CHIP[o.kind] ?? KIND_CHIP.note}`}>
                <span className="font-bold">{o.label}</span>
                <span className="ml-2 opacity-80">{o.detail}</span>
                <span className="ml-2 rounded bg-slate-900/40 px-1.5 py-0.5 text-[10px] opacity-75">
                  AI confidence {(o.confidence * 100).toFixed(0)}%
                </span>
                {o.competency && <span className="ml-2 text-[10px] opacity-70">→ {o.competency}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
