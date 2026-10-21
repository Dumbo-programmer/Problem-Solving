import FloatingMath from "./FloatingMath";
import { FloatingPlots } from "./MathPlots";

/**
 * Ambient decoration for a page's header strip: a soft brand-red glow, a few
 * drifting glyphs, scattered live plots (sine / parabola / orbit / ∞) and a
 * faint ruled band. Sits behind the heading with `-z-10`, so pages only need
 * one line to join the theme.
 */

interface PageDecorProps {
  seed?: number;
  count?: number;
  /** How many random maths plots to scatter behind the header. */
  plots?: number;
  className?: string;
}

export default function PageDecor({ seed = 5, count = 6, plots = 2, className = "" }: PageDecorProps) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden ${className}`}>
      <div className="absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-accent-300/15 blur-3xl" />
      <div className="absolute -top-16 right-1/4 h-56 w-56 rounded-full bg-ink-300/25 blur-3xl" />
      <FloatingPlots count={plots} seed={seed * 31 + 7} className="opacity-40" />
      <FloatingMath count={count} seed={seed} className="opacity-50" />
      <div className="absolute inset-x-0 bottom-0 h-40">
        <div className="retro-horizon !h-40" />
      </div>
    </div>
  );
}
