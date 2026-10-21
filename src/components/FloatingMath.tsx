import { useMemo } from "react";

/**
 * A drifting field of maths glyphs — π, ∑, √, ∫, θ … — rendered as light
 * decoration behind the hero and section headers. Positions are derived from a
 * fixed seed so server and client (and every reload) agree, and each symbol
 * gets its own bob duration so the field never pulses in unison.
 *
 * Purely decorative: hidden from assistive tech and pointer events.
 */

const SYMBOLS = ["π", "∑", "√", "∫", "θ", "Δ", "∞", "±", "≈", "α", "β", "λ", "μ", "σ", "Ω", "∂"];

/** Tiny deterministic PRNG (mulberry32) — same trick as the demo board. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FloatingMathProps {
  /** How many glyphs to scatter. */
  count?: number;
  /** Seed so different sections get different (but stable) layouts. */
  seed?: number;
  className?: string;
}

export default function FloatingMath({ count = 14, seed = 7, className = "" }: FloatingMathProps) {
  const glyphs = useMemo(() => {
    const rnd = mulberry32(seed * 9176 + count);
    return Array.from({ length: count }, (_, i) => {
      const size = 16 + Math.round(rnd() * 34);
      return {
        key: `${i}-${SYMBOLS[i % SYMBOLS.length]}`,
        char: SYMBOLS[i % SYMBOLS.length],
        left: `${Math.round(rnd() * 96)}%`,
        top: `${Math.round(rnd() * 92)}%`,
        size,
        // Alternate opacity so the field reads as depth, not noise.
        opacity: 0.06 + rnd() * 0.12,
        delay: `${(rnd() * 9).toFixed(2)}s`,
        duration: `${(8 + rnd() * 8).toFixed(1)}s`,
        rotate: `${Math.round(rnd() * 40 - 20)}deg`
      };
    });
  }, [count, seed]);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {glyphs.map((g) => (
        <span
          key={g.key}
          className="math-symbol text-ink-500 dark:text-accent-400/80"
          style={{
            left: g.left,
            top: g.top,
            fontSize: `${g.size}px`,
            opacity: g.opacity,
            transform: `rotate(${g.rotate})`,
            animation: `floaty ${g.duration} ease-in-out ${g.delay} infinite`
          }}
        >
          {g.char}
        </span>
      ))}
    </div>
  );
}
