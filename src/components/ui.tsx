import { GraduationCap, Sparkles } from 'lucide-react';
import type { AiStatus } from '../types';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="sf-logo-tile flex h-9 w-9 items-center justify-center rounded-xl text-white">
        <GraduationCap className="h-5 w-5" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[15px] font-extrabold tracking-tight text-white">
            AI StudyMate
          </div>
          <div className="text-[11px] font-medium text-slate-400">Learn. Test. Adapt. Master.</div>
        </div>
      )}
    </div>
  );
}

export function AiBadge({ status, className = '' }: { status: AiStatus | null; className?: string }) {
  const isDemo = status ? status.demo : true;
  return (
    <span
      className={`sf-aibadge ${className}`}
      title={
        isDemo
          ? 'Running on the built-in demo engine — add an AI API key in .env to enable live AI generation'
          : `Live AI: ${status?.label} (${status?.model})`
      }
    >
      <Sparkles className={`h-3.5 w-3.5 ${isDemo ? 'text-slate-400' : 'text-cyan-300'}`} aria-hidden="true" />
      {status ? (isDemo ? 'Demo Engine' : `${status.label} · ${status.model}`) : 'Connecting…'}
      <span
        className={`h-1.5 w-1.5 rounded-full ${isDemo ? 'bg-amber-400' : 'bg-emerald-400'}`}
        style={isDemo ? undefined : { boxShadow: '0 0 8px 1px rgba(52, 211, 153, 0.9)' }}
        aria-hidden="true"
      />
    </span>
  );
}

export function ProgressBar({ value, animate = false }: { value: number; animate?: boolean }) {
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all duration-700 ease-out ${animate ? 'progress-stripe' : ''}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
