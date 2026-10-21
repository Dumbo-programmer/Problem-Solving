/**
 * Animated maths plots — pure inline SVG, no charting library.
 *
 * Two curves worth of "proof that maths is alive": a sine wave that draws
 * itself under a rolling dash offset, and a parabola whose markers pulse.
 * Both carry a faint neon glow and are decorative only (aria-hidden); the
 * global `prefers-reduced-motion` rule freezes them for anyone who asked.
 */

import { useMemo } from "react";

interface SinePlotProps {
  className?: string;
  /** Seed the phase so two instances never look identical. */
  phase?: number;
}

/** Build a smooth sine path across the given box. */
function sinePath(width: number, height: number, phase: number, cycles = 2): string {
  const left = 8;
  const right = width - 8;
  const mid = height / 2;
  const amp = height / 2 - 14;
  const steps = 60;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = left + t * (right - left);
    const y = mid - Math.sin(t * Math.PI * 2 * cycles + phase) * amp;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

export function SinePlot({ className = "", phase = 0 }: SinePlotProps) {
  const W = 260;
  const H = 120;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="sine-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff2d95" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="sine-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* axis + grid */}
      <line x1="8" y1={H / 2} x2={W - 8} y2={H / 2} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 4" />
      <line x1={W / 2} y1="8" x2={W / 2} y2={H - 8} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 4" />
      <path
        d={sinePath(W, H, phase)}
        fill="none"
        stroke="url(#sine-stroke)"
        strokeWidth="2.6"
        strokeLinecap="round"
        filter="url(#sine-glow)"
        strokeDasharray="260"
        style={{ strokeDashoffset: 0, animation: "dash 6s ease-in-out infinite" }}
      />
    </svg>
  );
}

export function CurvePlot({ className = "" }: { className?: string }) {
  const W = 240;
  const H = 130;
  // A parabola y = (x - c)^2 style arc across the box.
  const points = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    const x = 10 + t * (W - 20);
    const y = 12 + Math.pow(t * 2 - 1, 2) * (H - 30);
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className={className} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="curve-stroke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#ff2d95" />
        </linearGradient>
        <filter id="curve-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={d} fill="none" stroke="url(#curve-stroke)" strokeWidth="2.6" strokeLinecap="round" filter="url(#curve-glow)" />
      {/* Sample markers that pulse like a plot resolving point by point. */}
      {[0.18, 0.5, 0.82].map((t, i) => {
        const x = 10 + t * (W - 20);
        const y = 12 + Math.pow(t * 2 - 1, 2) * (H - 30);
        return (
          <circle
            key={t}
            cx={x}
            cy={y}
            r="3.6"
            fill="#facc15"
            style={{ animation: `pulseGlow ${4 + i}s ease-in-out infinite` }}
          />
        );
      })}
    </svg>
  );
}

/** A slow "lissajous" ring of glyphs orbiting a centre — the infinity mirror. */
export function OrbitRing({ className = "", count = 12 }: { className?: string; count?: number }) {
  const glyphs = ["π", "∑", "√", "∫", "∞", "θ", "Δ", "x²", "y²", "sin", "cos", "∂"];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360;
        const radius = 42 + (i % 3) * 9;
        return (
          <span
            key={i}
            className="math-symbol text-accent-500/70 dark:text-accent-400/80"
            style={{
              left: "50%",
              top: "50%",
              fontSize: `${11 + (i % 4) * 4}px`,
              transform: `rotate(${angle}deg) translateX(${radius}%) rotate(${-angle}deg)`,
              transformOrigin: "center",
              animation: `floaty ${10 + (i % 5) * 2}s ease-in-out ${i * 0.4}s infinite`
            }}
          >
            {glyphs[i % glyphs.length]}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Random plot field — decoration, not a section                       */
/* ------------------------------------------------------------------ */

/** Tiny deterministic PRNG (mulberry32) — same trick as the glyph field. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FloatingPlotsProps {
  /** How many plots to scatter. */
  count?: number;
  /** Seed so different sections get different (but stable) layouts. */
  seed?: number;
  className?: string;
}

/**
 * A scattered field of live maths plots — sine waves, parabolas, orbit rings
 * and a lone ∞ — drifting behind a page as pure decoration. Positions come
 * from a fixed seed so every reload agrees; each plot keeps its own size,
 * phase, opacity and bob timing so the field never pulses in unison.
 *
 * Purely decorative: hidden from assistive tech and pointer events.
 */
export function FloatingPlots({ count = 5, seed = 13, className = "" }: FloatingPlotsProps) {
  const plots = useMemo(() => {
    const rnd = mulberry32(seed * 6089 + count);
    return Array.from({ length: count }, (_, i) => {
      const kind = i % 4; // 0 sine, 1 curve, 2 orbit, 3 infinity
      const size = 120 + Math.round(rnd() * 130);
      return {
        key: `${i}-${kind}`,
        kind,
        left: `${Math.round(rnd() * 84)}%`,
        top: `${Math.round(rnd() * 82)}%`,
        width: size,
        height: Math.round(size * 0.62),
        phase: rnd() * Math.PI * 2,
        opacity: 0.12 + rnd() * 0.2,
        delay: `${(rnd() * 10).toFixed(2)}s`,
        duration: `${12 + rnd() * 10}s`,
        rotate: `${Math.round(rnd() * 30 - 15)}deg`
      };
    });
  }, [count, seed]);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {plots.map((p) => (
        <div
          key={p.key}
          className="absolute"
          style={{
            left: p.left,
            top: p.top,
            opacity: p.opacity,
            transform: `rotate(${p.rotate})`,
            animation: `floaty ${p.duration} ease-in-out ${p.delay} infinite`
          }}
        >
          {p.kind === 0 ? (
            <SinePlot className="text-slate-400 dark:text-accent-500/60" phase={p.phase} />
          ) : p.kind === 1 ? (
            <CurvePlot className="dark:opacity-90" />
          ) : p.kind === 2 ? (
            <div className="relative" style={{ width: p.width, height: p.width }}>
              <OrbitRing count={9} />
            </div>
          ) : (
            <span
              className="block font-mono font-bold neon-text"
              style={{ fontSize: `${p.width * 0.4}px`, lineHeight: 1 }}
            >
              ∞
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

