// ---------------------------------------------------------------------------
// SKILLFORGE AI — VIRTUAL EQUIPMENT BENCH.
//
// The "online motherboard / fan simulator" layer: an interactive SVG machine
// the candidate actually WORKS ON. Every applied action visibly changes the
// bench (alarms clear, readings update, parts get tags) — so the interface is
// doing-and-observing, not reading-and-choosing. Judgement still runs through
// the same deterministic forge engine; the bench is presentation.
//
// Two benches:
//   'ev-pack'  — EV pack diagnostic bench (cells, isolation links, busbar).
//   'fan'      — ceiling-fan / BLDC motor rig (rotor, capacitor, windings).
// ---------------------------------------------------------------------------

import type { ForgeSession, SystemDatum } from '../../forge/types';

interface VirtualBenchProps {
  benchKind: 'ev-pack' | 'fan' | null | undefined;
  session: ForgeSession;
  liveData: SystemDatum[];
  /** Fired when the candidate clicks a clickable zone on the equipment itself. */
  onZoneAction: (actionId: string) => void;
  disabled?: boolean;
}

/** Suffix-less helper: read a live-data value like 'Pack voltage'. */
function dataValue(live: SystemDatum[], label: string): string {
  return live.find((d) => d.label === label)?.value ?? '';
}

function IsoGlyph({ state }: { state: 'unknown' | 'open' }) {
  return (
    <g>
      <rect x="12" y="26" width="34" height="10" rx="2" className={state === 'open' ? 'fill-emerald-400' : 'fill-slate-600'} />
      <rect x="52" y="26" width="34" height="10" rx="2" className={state === 'open' ? 'fill-emerald-400' : 'fill-slate-600'} />
      <line x1="46" y1="20" x2="52" y2="42" stroke="currentColor" strokeWidth="3" className="text-slate-400" />
      <text x="49" y="58" textAnchor="middle" fontSize="9" className="fill-slate-400 font-sans">
        {state === 'open' ? 'LINKS OPEN' : 'LINKS CLOSED'}
      </text>
    </g>
  );
}

/** ------------------------------ EV PACK BENCH ------------------------------ */
function EvPackBench({ session, live, onZoneAction, disabled }: { session: ForgeSession; live: SystemDatum[]; onZoneAction: (id: string) => void; disabled?: boolean }) {
  const done = new Set(session.completedSafety);
  const isolated = done.has('HV_ISOLATION');
  const ppe = done.has('HV_PPE');
  const verified = done.has('HV_VERIFY');
  const hotjoint = dataValue(live, 'Busbar joint 2').includes('hotspot');

  const cellSag = dataValue(live, 'Cell-7 vs others').includes('sag');

  return (
    <svg viewBox="0 0 420 250" className="w-full max-w-xl mx-auto" role="img" aria-label="Interactive EV pack diagnostic bench">
      <defs>
        <linearGradient id="bench-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect x="10" y="90" width="400" height="150" rx="10" fill="url(#bench-metal)" stroke="#334155" strokeWidth="2" />

      {/* isolation links + pull handle */}
      <g
        className={disabled ? 'opacity-60' : 'cursor-pointer'}
        data-testid="bench-zone-isolate"
        onClick={() => !disabled && onZoneAction('bench-isolate')}
      >
        <IsoGlyph state={isolated ? 'open' : 'unknown'} />
        <circle cx="49" cy="98" r="7" className={isolated ? 'fill-emerald-500' : 'fill-red-500'} />
        <text x="49" y="118" textAnchor="middle" fontSize="9" className="fill-slate-300 font-sans">PULL DISCONNECT</text>
      </g>

      {/* the cell group */}
      {Array.from({ length: 8 }).map((_, i) => {
        const isCell7 = i === 6;
        const dimmed = isolated;
        return (
          <g key={i}>
            <rect
              x={110 + i * 30}
              y={100}
              width={22}
              height={44}
              rx="3"
              className={
                (dimmed ? 'fill-slate-700' : 'fill-cyan-900') +
                (isCell7 && cellSag && !dimmed ? ' stroke-red-400' : isCell7 ? ' stroke-amber-400' : ' stroke-slate-600')
              }
              strokeWidth="1.5"
            />
            <text x={121 + i * 30} y="130" textAnchor="middle" fontSize="8" className="fill-slate-300 font-sans">
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* terminal block verification tag */}
      <g data-testid="bench-zone-verify">
        <rect x={110} y={158} width={236} height={18} rx="4" className={verified ? 'fill-emerald-600' : 'fill-slate-800'} stroke="#475569" />
        <text x={228} y="171" textAnchor="middle" fontSize="9" className={verified ? 'fill-emerald-200 font-sans' : 'fill-slate-400 font-sans'}>
          {verified ? '0 V VERIFIED ×2' : 'TERMinals — UNVERIFIED (meter the gap)'}
        </text>
      </g>

      {/* busbar + hotspot */}
      <rect x={110} y={186} width={236} height={10} rx="2" className={hotjoint ? 'fill-orange-600' : 'fill-slate-600'} />
      {hotjoint && (
        <circle cx={200} cy={191} r="5" className="fill-red-400 animate-pulse" data-testid="bench-hotspot" />
      )}
      <text x={228} y={212} textAnchor="middle" fontSize="9" className="fill-slate-400 font-sans">BUSBAR · joint 2</text>

      {/* PPE strip */}
      <g data-testid="bench-zone-ppe" onClick={() => !disabled && onZoneAction('bench-wear-ppe')} className={disabled ? '' : 'cursor-pointer'}>
        <rect x={20} y={200} width={70} height={26} rx="6" className={ppe ? 'fill-emerald-700' : 'fill-red-900'} stroke="#475569" />
        <text x={55} y="217" textAnchor="middle" fontSize="9" className="fill-slate-100 font-sans">
          {ppe ? 'PPE ON' : 'PPE OFF'}
        </text>
      </g>

      {/* live status strip */}
      <text x={352} y={215} fontSize="9" textAnchor="middle" className="fill-slate-300 font-mono">
        {isolated ? 'SAFE' : 'LIVE'}
      </text>
    </svg>
  );
}

/** ---------------------------- CEILING FAN BENCH --------------------------- */
function FanBench({ session, live, onZoneAction, disabled }: { session: ForgeSession; live: SystemDatum[]; onZoneAction: (id: string) => void; disabled?: boolean }) {
  const locked = session.completedSafety.includes('ROTATING_PARTS');
  const bled = session.completedSafety.includes('CAPACITOR_DISCHARGE');
  const capText = dataValue(live, 'Capacitor');
  const capFixed = capText.includes('2.5') && capText.includes('new') || dataValue(live, 'Rotation').includes('nominal');
  const spinning = !locked && !capFixed;

  return (
    <svg viewBox="0 0 420 250" className="w-full max-w-xl mx-auto" role="img" aria-label="Interactive ceiling fan / BLDC motor test rig">
      {/* ceiling mount */}
      <rect x="196" y="12" width="28" height="14" rx="3" className="fill-slate-600" />
      <rect x="206" y="26" width="8" height="18" className="fill-slate-500" />

      {/* rotor hub + blades */}
      <g transform="translate(210 92)" data-testid="bench-fan-rotor">
        <g style={spinning ? { animation: 'sf-spin 1.4s linear infinite', transformOrigin: 'center' } : undefined}>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse key={deg} cx="0" cy="-38" rx="7" ry="34" transform={`rotate(${deg})`} className="fill-slate-400/90" />
          ))}
        </g>
        <circle r="12" className={locked ? 'fill-slate-700 stroke-emerald-400' : 'fill-slate-300 stroke-slate-500'} strokeWidth="2" />
        <text y="4" textAnchor="middle" fontSize="9" className="fill-slate-800 font-sans">{locked ? 'STOP' : 'LIVE'}</text>
      </g>

      {/* capacitor block */}
      <g data-testid="bench-zone-cap" onClick={() => !disabled && onZoneAction('bench-fan-mc-cap')} className={disabled ? '' : 'cursor-pointer'}>
        <rect x="44" y="150" width="52" height="34" rx="6" className={bled ? 'fill-slate-700 stroke-emerald-400' : capFixed ? 'fill-cyan-900 stroke-cyan-400' : 'fill-red-900 stroke-red-400'} strokeWidth="1.5" />
        <text x="70" y="170" textAnchor="middle" fontSize="9" className="fill-slate-100 font-sans">CAP</text>
        <text x="70" y="180" textAnchor="middle" fontSize="8" className="fill-slate-300 font-mono">
          {capFixed ? '2.5 µF NEW' : capText || '—'}
        </text>
        {bled && <text x="70" y="196" textAnchor="middle" fontSize="8" className="fill-emerald-300 font-sans">DISCHARGED · 0 V</text>}
      </g>

      {/* winding table */}
      <g data-testid="bench-zone-winding">
        <rect x="140" y="150" width="140" height="34" rx="6" className="fill-slate-800 stroke-slate-600" />
        <text x="210" y="166" textAnchor="middle" fontSize="8" className="fill-slate-400 font-sans">WINDING TABLE</text>
        <text x="210" y="179" textAnchor="middle" fontSize="9" className="fill-slate-200 font-mono">{dataValue(live, 'Winding table') || 'run — / start —'}</text>
      </g>

      {/* bleed resistor + lockout buttons */}
      <g onClick={() => !disabled && onZoneAction('bench-fan-iso')} data-testid="bench-zone-fan-iso" className={disabled ? '' : 'cursor-pointer'}>
        <rect x="330" y="150" width="66" height="26" rx="6" className={locked ? 'fill-emerald-800' : 'fill-amber-800'} stroke="#475569" />
        <text x="363" y="167" textAnchor="middle" fontSize="9" className="fill-slate-100 font-sans">{locked ? 'LOCKED OUT' : 'LOCK OUT'}</text>
      </g>
      <g onClick={() => !disabled && onZoneAction('bench-fan-bleed-cap')} data-testid="bench-zone-bleed" className={disabled ? '' : 'cursor-pointer'}>
        <rect x="330" y="184" width="66" height="26" rx="6" className="fill-slate-700" stroke="#475569" />
        <text x="363" y="201" textAnchor="middle" fontSize="9" className="fill-slate-100 font-sans">BLEED CAP</text>
      </g>

      <text x="210" y="232" textAnchor="middle" fontSize="9" className="fill-slate-400 font-sans">
        {dataValue(live, 'Rotation') || 'rotor reading —'}
      </text>
    </svg>
  );
}

export default function VirtualBench({ benchKind, session, liveData, onZoneAction, disabled }: VirtualBenchProps) {
  if (!benchKind) return null;
  return (
    <div className="sf-card sf-card-hot mt-4 p-5" data-testid="forge-virtual-bench">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xs font-bold tracking-[0.12em] text-cyan-300">VIRTUAL EQUIPMENT BENCH · INTERACTIVE</h2>
        <span className="sf-chip sf-chip-good">click zones on the machine to act</span>
      </div>
      <div className="mt-3 text-slate-300">
        {benchKind === 'ev-pack' ? (
          <EvPackBench session={session} live={liveData} onZoneAction={onZoneAction} disabled={disabled} />
        ) : (
          <FanBench session={session} live={liveData} onZoneAction={onZoneAction} disabled={disabled} />
        )}
      </div>
      <style>{'@keyframes sf-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }'}</style>
    </div>
  );
}
