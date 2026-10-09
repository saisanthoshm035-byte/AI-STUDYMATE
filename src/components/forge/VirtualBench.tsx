// ---------------------------------------------------------------------------
// SKILLFORGE AI — VIRTUAL EQUIPMENT BENCH (3D).
//
// Isometric pseudo-3D hardware sim: an HV pack on a workbench and a BLDC
// ceiling-fan rig, rendered with depth (extruded bodies, shaded faces,
// drop shadows). The candidate clips VIRTUAL INSTRUMENTS onto the machine:
// multimeter with live probe leads, thermal-imaging camera, isolation
// handle. Every applied action physically changes the machine; judgement
// stays in the deterministic forge engine.
//
// Depth model: every depth unit `d` (in px, going "into" the scene) maps to
// a screen offset of (d*DX, -d*DY) with DX < DY so the isometric reads
// natural. All faces derive from that offset.
// ---------------------------------------------------------------------------

import type { ForgeSession, SystemDatum } from '../../forge/types';

interface VirtualBenchProps {
  benchKind: 'ev-pack' | 'fan' | null | undefined;
  session: ForgeSession;
  liveData: SystemDatum[];
  onZoneAction: (actionId: string) => void;
  disabled?: boolean;
}

function dataValue(live: SystemDatum[], label: string): string {
  return live.find((d) => d.label === label)?.value ?? '';
}

const DX = 0.62; // horizontal px per depth px
const DY = 0.34; // vertical px per depth px (upward)

/** Extruded slab helper: top face + two side faces at isometric angles. */
function slabFaces(x: number, y: number, w: number, h: number, d: number) {
  const ox = d * DX;
  const oy = d * DY;
  return {
    top: `${x},${y - h} ${x + w},${y - h} ${x + w + ox},${y - h - oy} ${x + ox},${y - h - oy}`,
    left: `${x},${y - h} ${x + ox},${y - h - oy} ${x + ox},${y - oy} ${x},${y}`,
    right: `${x + w},${y - h} ${x + w + ox},${y - h - oy} ${x + w + ox},${y - oy} ${x + w},${y}`,
  };
}

function Slab({
  x, y, w, d, h, top, left, right, stroke, testid, children,
}: {
  x: number; y: number; w: number; d: number; h: number;
  top: string; left: string; right?: string; stroke?: string; testid?: string; children?: React.ReactNode;
}) {
  const f = slabFaces(x, y, w, h, d);
  return (
    <g data-testid={testid}>
      <polygon points={f.left} fill={left} stroke={stroke} strokeWidth="1" />
      <polygon points={f.right} fill={right ?? left} stroke={stroke} strokeWidth="1" />
      <polygon points={f.top} fill={top} stroke={stroke} strokeWidth="1" />
      <ellipse cx={x + w / 2 + (d * DX) / 2} cy={y + 3} rx={w * 0.55} ry="6" className="fill-black/25" />
      {children}
    </g>
  );
}

/* --------------------------------- EV PACK ------------------------------- */
function EvPack3D({ session, live, onZoneAction, disabled = false }: { session: ForgeSession; live: SystemDatum[]; onZoneAction: (id: string) => void; disabled?: boolean }) {
  const isolated = session.completedSafety.includes('HV_ISOLATION');
  const ppe = session.completedSafety.includes('HV_PPE');
  const verified = session.completedSafety.includes('HV_VERIFY');
  const hotjoint = dataValue(live, 'Busbar joint 2').includes('hotspot');
  const cellSag = dataValue(live, 'Cell-7 vs others').includes('sag');
  const CELL_D = 14; // cell depth px

  return (
    <svg viewBox="0 0 460 300" className="w-full max-w-xl mx-auto" role="img" aria-label="3D EV pack diagnostic bench">
      <defs>
        <radialGradient id="hot-glow">
          <stop offset="0" stopColor="#f97316" stopOpacity="0.85" />
          <stop offset="1" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ============ workbench slab (a wide, shallow 3D table) ============ */}
      <Slab x={40} y={252} w={360} d={54} h={14} top="#273449" left="#141b26" right="#0e1319" stroke="#334155" />

      {/* ============ the HV pack: one extruded case holding 8 3D cells ============ */}
      <g transform="translate(92 96)">
        <Slab x={0} y={0} w={216} d={CELL_D} h={0} top="#0f2740" left="#0a1c30" stroke="#1e4a6b" testid="bench3d-pack" />
        {Array.from({ length: 8 }).map((_, i) => {
          const isCell7 = i === 6 && cellSag;
          const cx = 6 + i * 26;
          const stroke = isCell7 ? '#ef4444' : '#155e75';
          const face = isCell7 ? '#3f1d1d' : '#0e3a5c';
          const side = isCell7 ? '#26141c' : '#08203a';
          const f = slabFaces(cx, 40, 18, 34, CELL_D - 6);
          return (
            <g key={i}>
              <polygon points={f.left} fill={side} stroke={stroke} strokeWidth="1" />
              <polygon points={f.right} fill={side} stroke={stroke} strokeWidth="1" />
              <polygon points={f.top} fill={face} stroke={stroke} strokeWidth="1" />
              <text x={cx + 9} y={36 - (CELL_D - 6) * DY} textAnchor="middle" fontSize="7" className={isCell7 ? 'fill-red-300' : 'fill-sky-300 font-mono'}>{i + 1}</text>
              <text x={cx + 9} y={26} textAnchor="middle" fontSize="6" className="fill-slate-400 font-mono">3.7V</text>
            </g>
          );
        })}
        <text x={108} y={-22} textAnchor="middle" fontSize="9" className="fill-slate-400 font-sans">HV PACK · 48 V NOMINAL · 8S</text>
        {cellSag && <text x={6 + 6 * 26 + 9} y={-6} textAnchor="middle" fontSize="7" className="fill-red-300 font-mono">▼ cell 7</text>}
      </g>

      {/* isolation links: 3D slab + chrome pull handle */}
      <g data-testid="bench-zone-isolate" onClick={() => !disabled && onZoneAction('bench-isolate')} className={disabled ? '' : 'cursor-pointer transition hover:opacity-90'}>
        <Slab
          x={56} y={206} w={104} d={10} h={7}
          top={isolated ? '#10b981' : '#dc2626'}
          left={isolated ? '#047857' : '#991b1b'}
          stroke="#0f172a"
        />
        <rect x={102} y={isolated ? 182 : 190} width={7} height={16} rx="3" className="fill-slate-300" />
        <rect x={102} y={isolated ? 182 : 190} width={3} height={16} rx="1.5" className="fill-slate-100" />
        <text x={170} y={214} fontSize="9" className="fill-slate-200 font-sans">
          {isolated ? 'LINKS OPEN — ISOLATED' : 'LINKS CLOSED · PULL'}
        </text>
        <text x={170} y={226} fontSize="7" className={isolated ? 'fill-emerald-300' : 'fill-red-300'}>
          {isolated ? 'CONTACTORS OPEN · SYSTEM SAFE' : 'LIVE · 52.4 V'}
        </text>
      </g>

      {/* busbar (extruded, hot when scanned) */}
      <Slab
        x={200} y={238} w={150} d={8} h={5}
        top={hotjoint ? '#f97316' : '#64748b'}
        left={hotjoint ? '#c2410c' : '#475569'}
        stroke="#1e293b"
        testid="bench3d-busbar"
      />
      {hotjoint && <circle cx={272} cy={226} r={15} fill="url(#hot-glow)" data-testid="bench-hotspot" />}
      <text x={275} y={256} textAnchor="middle" fontSize="7" className="fill-slate-400 font-sans">BUSBAR · joint 2</text>

      {/* verification strip on the bench front face */}
      <rect x={200} y={266} width={150} height={13} rx="3" className={verified ? 'fill-emerald-600' : 'fill-slate-800'} stroke="#475569" />
      <text x={275} y={276} textAnchor="middle" fontSize="7" className={verified ? 'fill-emerald-100 font-mono' : 'fill-slate-400 font-mono'}>
        {verified ? '0 V VERIFIED ×2' : 'TERMINALS — UNVERIFIED'}
      </text>

      {/* thermal camera attachment — clips on after hotspot found */}
      {hotjoint && (
        <g data-testid="bench3d-thermalcam" transform="translate(150 150)">
          <rect x="-14" y="-30" width="72" height="26" rx="5" className="fill-slate-900 stroke-amber-400" strokeWidth="1.5" />
          <rect x="-9" y="-26" width="26" height="18" rx="3" className="fill-slate-950" />
          <ellipse cx="4" cy="-17" rx="9" ry="6" fill="url(#hot-glow)" />
          <text x="30" y="-15" fontSize="7" className="fill-amber-300 font-mono">+18 °C @ joint 2</text>
        </g>
      )}

      {/* multimeter attachment — clips on when 0 V is verified */}
      {verified && (
        <g data-testid="bench3d-multimeter" transform="translate(300 130)">
          <rect x="-10" y="-22" width="62" height="40" rx="6" className="fill-slate-900 stroke-cyan-400" strokeWidth="1.5" />
          <rect x="-6" y="-17" width="54" height="14" rx="2" className="fill-slate-800" />
          <text x="21" y="-6" textAnchor="middle" fontSize="10" className="fill-emerald-400 font-mono">0.00 V</text>
          <text x="21" y="10" textAnchor="middle" fontSize="7" className="fill-slate-400">CAT III · AUTO</text>
          {/* probe leads reaching down to the terminals */}
          <path d="M -4,18 C -14,44 -24,64 -30,84" className="stroke-red-500" strokeWidth="2" fill="none" />
          <path d="M 46,18 C 54,44 60,64 62,84" className="stroke-slate-950" strokeWidth="2" fill="none" />
          <circle cx="-30" cy={86} r="3.5" className="fill-red-500" />
          <circle cx="62" cy={86} r="3.5" className="fill-slate-900 stroke-slate-400" />
        </g>
      )}

      {/* PPE control */}
      <g data-testid="bench-zone-ppe" onClick={() => !disabled && onZoneAction('bench-wear-ppe')} className={disabled ? '' : 'cursor-pointer transition hover:opacity-90'}>
        <rect x={52} y={272} width={80} height={26} rx={8} className={ppe ? 'fill-emerald-700 stroke-emerald-400' : 'fill-red-900 stroke-red-500'} strokeWidth="1.5" />
        <text x={92} y={289} textAnchor="middle" fontSize="10" className="fill-slate-100 font-sans">{ppe ? 'PPE ON ✓' : 'PPE OFF'}</text>
      </g>
    </svg>
  );
}

/* --------------------------------- FAN RIG ------------------------------- */
function Fan3D({ session, live, onZoneAction, disabled = false }: { session: ForgeSession; live: SystemDatum[]; onZoneAction: (id: string) => void; disabled?: boolean }) {
  const locked = session.completedSafety.includes('ROTATING_PARTS');
  const bled = session.completedSafety.includes('CAPACITOR_DISCHARGE');
  const capText = dataValue(live, 'Capacitor');
  const capFixed = Boolean((capText.includes('2.5') && capText.includes('new')) || dataValue(live, 'Rotation').includes('nominal'));
  const spinning = !locked && !capFixed;

  return (
    <svg viewBox="0 0 460 300" className="w-full max-w-xl mx-auto" role="img" aria-label="3D ceiling fan BLDC test rig">
      <defs>
        <radialGradient id="cap-glow">
          <stop offset="0" stopColor="#f87171" stopOpacity="0.7" />
          <stop offset="1" stopColor="#f87171" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ceiling plate + downrod */}
      <Slab x={196} y={34} w={68} d={12} h={9} top="#64748b" left="#3f4b5c" stroke="#334155" />
      <rect x={224} y={40} width={12} height={30} className="fill-slate-500" />
      <rect x={224} y={40} width={5} height={30} className="fill-slate-300" />

      {/* fan hub with 3-D blades in isometric spin */}
      <g transform="translate(230 140) scale(1 0.55)" data-testid="bench3d-rotor">
        <g style={spinning ? { animation: 'sf-spin3d 0.9s linear infinite', transformOrigin: 'center' } : undefined} opacity={spinning ? 0.8 : 1}>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <g key={deg} transform={`rotate(${deg})`}>
              <polygon points="0,-84 5,-84 12,-14 -5,-14" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
              <polygon points="5,-84 9,-80 12,-14 5,-14" fill="#5b6b7e" />
            </g>
          ))}
        </g>
        {/* hub: layered ellipse stack reads as a 3D dome */}
        <ellipse rx="30" ry="30" fill="#64748b" />
        <ellipse rx="24" ry="24" cy="-6" fill="#94a3b8" />
        <ellipse rx="18" ry="18" cy="-10" fill="#cbd5e1" />
        <ellipse rx="8" ry="8" cy="-12" fill="#e2e8f0" />
      </g>
      <text x={230} y={96} textAnchor="middle" fontSize="9" className={locked ? 'fill-emerald-400 font-mono' : 'fill-red-400 font-mono'}>
        {locked ? '● SAFE — LOCKED OUT' : '● LIVE — 230 V'}
      </text>

      {/* capacitor: extruded cylinder (in 3D on the worktop) */}
      <g data-testid="bench-zone-cap" onClick={() => !disabled && onZoneAction('bench-fan-mc-cap')} className={disabled ? '' : 'cursor-pointer transition hover:opacity-90'}>
        <rect x={64} y={224} width={64} height={22} className={bled ? 'fill-slate-600' : capFixed ? 'fill-cyan-800' : 'fill-red-800'} />
        <ellipse cx={96} cy={224} rx={32} ry={10} className={bled ? 'fill-slate-400' : capFixed ? 'fill-cyan-500' : 'fill-red-500'} stroke="#1e293b" />
        <ellipse cx={96} cy={246} rx={32} ry={10} className={bled ? 'fill-slate-800' : capFixed ? 'fill-cyan-950' : 'fill-red-950'} />
        <text x={96} y={240} textAnchor="middle" fontSize="8" className="fill-slate-100 font-mono">
          {capFixed ? '2.5 µF NEW' : capText.slice(0, 20) || 'RUN CAP —'}
        </text>
        {bled && <text x={96} y={266} textAnchor="middle" fontSize="8" className="fill-emerald-300 font-mono">DISCHARGED · 0 V ✓</text>}
        {!bled && !capFixed && <ellipse cx={96} cy={232} rx={40} ry={14} fill="url(#cap-glow)" opacity="0.35" />}
      </g>

      {/* winding instrument panel: 3D slab */}
      <Slab x={170} y={252} w={140} d={8} h={7} top="#1e293b" left="#0f172a" stroke="#334155" testid="bench3d-windingpanel" />
      <text x={240} y={238} textAnchor="middle" fontSize="7" className="fill-slate-400 font-sans">WINDING TABLE</text>
      <text x={240} y={224} textAnchor="middle" fontSize="9" className="fill-slate-200 font-mono">{dataValue(live, 'Winding table') || 'run — / start —'}</text>

      {/* lock out control */}
      <g data-testid="bench-zone-fan-iso" onClick={() => !disabled && onZoneAction('bench-fan-iso')} className={disabled ? '' : 'cursor-pointer transition hover:opacity-90'}>
        <rect x={330} y={238} width={92} height={28} rx={8} className={locked ? 'fill-emerald-700 stroke-emerald-400' : 'fill-amber-800 stroke-amber-500'} strokeWidth="1.5" />
        <text x={376} y={256} textAnchor="middle" fontSize="10" className="fill-slate-100 font-sans">{locked ? 'LOCKED OUT' : 'LOCK OUT'}</text>
      </g>

      {/* bleed control */}
      <g data-testid="bench-zone-bleed" onClick={() => !disabled && onZoneAction('bench-fan-bleed-cap')} className={disabled ? '' : 'cursor-pointer transition hover:opacity-90'}>
        <rect x={330} y={272} width={92} height={26} rx={8} className="fill-slate-700 stroke-slate-500" strokeWidth="1.5" />
        <text x={376} y={289} textAnchor="middle" fontSize="10" className="fill-slate-100 font-sans">BLEED CAP</text>
      </g>

      {/* rotation readout */}
      <text x={230} y={292} textAnchor="middle" fontSize="9" className="fill-slate-300 font-mono">
        {dataValue(live, 'Rotation') || 'rotor reading —'}
      </text>
    </svg>
  );
}

export default function VirtualBench({ benchKind, session, liveData, onZoneAction, disabled }: VirtualBenchProps) {
  if (!benchKind) return null;
  return (
    <div className="sf-card sf-card-hot mt-4 overflow-hidden p-5" data-testid="forge-virtual-bench">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xs font-bold tracking-[0.12em] text-cyan-300">3D VIRTUAL EQUIPMENT BENCH · LIVE</h2>
        <span className="sf-chip sf-chip-good">click the machine · instruments clip on</span>
      </div>
      <div className="mt-3 text-slate-300">
        {benchKind === 'ev-pack' ? (
          <EvPack3D session={session} live={liveData} onZoneAction={onZoneAction} disabled={disabled} />
        ) : (
          <Fan3D session={session} live={liveData} onZoneAction={onZoneAction} disabled={disabled} />
        )}
      </div>
      <style>{'@keyframes sf-spin3d { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }'}</style>
    </div>
  );
}
