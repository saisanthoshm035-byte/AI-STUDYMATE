import { useEffect, useRef } from 'react';

/**
 * Hero3D — interactive 3D "knowledge constellation" on a plain <canvas>,
 * powered by a tiny hand-rolled 3D projection engine (zero dependencies).
 *
 * Interactions:
 *  - drag (or touch-drag) to spin the constellation, with inertia
 *  - hover / tap a node to highlight it and reveal its concept label
 *  - click / tap empty space to send a glowing pulse wave through the network
 *
 * Purely decorative intelligence-layer visuals; pauses when the tab hides
 * and renders at devicePixelRatio for crispness.
 */

const NODES: { label: string; ring: number; phase: number; hue: string }[] = [
  { label: 'Learn', ring: 1, phase: 0.0, hue: '#818cf8' },
  { label: 'Test', ring: 1, phase: 1.26, hue: '#22d3ee' },
  { label: 'Detect', ring: 1, phase: 2.51, hue: '#fbbf24' },
  { label: 'Adapt', ring: 1, phase: 3.77, hue: '#a78bfa' },
  { label: 'Master', ring: 1, phase: 5.03, hue: '#34d399' },
  { label: 'Confidence', ring: 2, phase: 0.6, hue: '#f472b6' },
  { label: 'Misconception', ring: 2, phase: 1.7, hue: '#fb7185' },
  { label: 'Teach-Back', ring: 2, phase: 2.8, hue: '#38bdf8' },
  { label: 'Retention', ring: 2, phase: 3.9, hue: '#facc15' },
  { label: 'Re-Teach', ring: 2, phase: 5.0, hue: '#4ade80' },
  { label: 'Quick Review', ring: 2, phase: 0.2, hue: '#c084fc' },
  { label: 'AI Tutor', ring: 0, phase: 0, hue: '#e0e7ff' },
];

// Meaningful edges: inner cycle + spokes to the AI core + outer satellite links.
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
  [11, 0], [11, 1], [11, 2], [11, 3], [11, 4],
  [5, 1], [6, 2], [7, 3], [8, 4], [9, 0], [10, 3],
  [5, 7], [7, 8], [8, 10],
];

interface Vec3 { x: number; y: number; z: number }

function rot(p: Vec3, ax: number, ay: number): Vec3 {
  const cy = Math.cos(ay), sy = Math.sin(ay);
  const x1 = p.x * cy - p.z * sy;
  const z1 = p.x * sy + p.z * cy;
  const cx = Math.cos(ax), sx = Math.sin(ax);
  const y2 = p.y * cx - z1 * sx;
  const z2 = p.y * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}

export default function Hero3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let ax = -0.42, ay = 0.6;          // rotation
    let vax = 0.0016, vay = 0.0042;    // idle drift velocities
    let dragging = false, lastX = 0, lastY = 0, moved = 0;
    let hoverIdx = -1;
    let pulse = -1;                    // expanding pulse wave radius seed
    let raf = 0;
    let t = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const project = (p: Vec3) => {
      const scale = Math.min(w, h) * 0.34;
      const persp = 2.6 / (2.6 + p.z);
      return { sx: w / 2 + p.x * scale * persp, sy: h / 2 + p.y * scale * persp, z: p.z, persp };
    };

    const nodePos = (i: number, time: number): Vec3 => {
      const n = NODES[i];
      if (n.ring === 0) return { x: 0, y: 0, z: 0 };
      const wob = Math.sin(time * 0.7 + n.phase * 2) * 0.08;
      const r = n.ring === 1 ? 1 : 1.55;
      const tilt = n.ring === 1 ? 0.35 : -0.28; // two tilted rings = gyroscope feel
      const a = n.phase + time * (n.ring === 1 ? 0.05 : -0.033);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.sin(a) * r * tilt + wob;
      return { x, y, z };
    };

    const draw = () => {
      t += reduced ? 0 : 1 / 60;
      if (!dragging) { ax += vax; ay += vay; vax *= 0.995; vay = vay * 0.995 + 0.00003; }
      ctx.clearRect(0, 0, w, h);

      const pts = NODES.map((_, i) => project(rot(nodePos(i, t), ax, ay)));

      // pulse wave
      if (pulse >= 0) {
        pulse += 0.016;
        if (pulse > 1.8) pulse = -1;
      }

      // edges
      for (const [a, b] of EDGES) {
        const pa = pts[a], pb = pts[b];
        const depth = (pa.z + pb.z) / 2;
        const alpha = 0.34 - depth * 0.16;
        ctx.strokeStyle = `rgba(129, 140, 248, ${Math.max(0.05, alpha)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        // slight curve for organic feel
        const mx = (pa.sx + pb.sx) / 2, my = (pa.sy + pb.sy) / 2;
        ctx.quadraticCurveTo(mx, my + 6 * pa.persp, pb.sx, pb.sy);
        ctx.stroke();

        // travelling data packet along the edge
        if (!reduced) {
          const k = ((t * 0.35 + a * 0.13 + b * 0.07) % 1);
          const px = pa.sx + (pb.sx - pa.sx) * k;
          const py = pa.sy + (pb.sy - pa.sy) * k;
          ctx.fillStyle = 'rgba(165, 180, 252, 0.85)';
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // pulse ring
      if (pulse >= 0) {
        ctx.strokeStyle = `rgba(129, 140, 248, ${(1 - pulse / 1.8) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, pulse * Math.min(w, h) * 0.45, 0, Math.PI * 2);
        ctx.stroke();
      }

      // nodes
      NODES.forEach((n, i) => {
        const p = pts[i];
        const front = p.z > 0;
        const base = n.ring === 0 ? 9 : n.ring === 1 ? 6.5 : 5;
        const r = base * p.persp * (i === hoverIdx ? 1.5 : 1);
        const glow = i === hoverIdx ? 0.95 : front ? 0.8 : 0.45;

        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 3.2);
        g.addColorStop(0, n.hue + '');
        g.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.globalAlpha = glow * 0.35;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = n.hue;
        ctx.globalAlpha = glow;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (n.ring === 0) {
          ctx.strokeStyle = 'rgba(224, 231, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r + 6 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (i === hoverIdx) {
          ctx.font = `600 ${Math.round(12 * Math.min(1.2, p.persp))}px Inter, sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.96)';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, p.sx, p.sy - r - 10);
        }
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // ------------------------------------------------------------- pointer
    const pick = (mx: number, my: number) => {
      let best = -1, bestD = 18;
      const pts = NODES.map((_, i) => project(rot(nodePos(i, t), ax, ay)));
      pts.forEach((p, i) => {
        const d = Math.hypot(p.sx - mx, p.sy - my);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };

    const onDown = (e: PointerEvent) => {
      dragging = true; moved = 0;
      lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        ay += dx * 0.005;
        ax += dy * 0.005;
        vay = dx * 0.005; vax = dy * 0.005;
        lastX = e.clientX; lastY = e.clientY;
      } else {
        hoverIdx = pick(mx, my);
        canvas.style.cursor = hoverIdx >= 0 ? 'pointer' : 'grab';
      }
    };
    const onUp = (e: PointerEvent) => {
      if (dragging && moved < 6) {
        const rect = canvas.getBoundingClientRect();
        const idx = pick(e.clientX - rect.left, e.clientY - rect.top);
        pulse = 0.001; // tap = pulse wave (or node pop if picked)
        if (idx >= 0) hoverIdx = idx;
      }
      dragging = false;
    };
    const onLeave = () => { dragging = false; hoverIdx = -1; };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    const onVis = () => {
      if (document.hidden) { cancelAnimationFrame(raf); }
      else { raf = requestAnimationFrame(draw); }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="h-[340px] w-full touch-none select-none sm:h-[420px]"
        style={{ cursor: 'grab' }}
        aria-label="Interactive 3D visualization of the AI StudyMate learning loop — drag to rotate, tap to pulse"
        role="img"
      />
      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-sm">
        drag to spin · tap to pulse
      </span>
    </div>
  );
}
