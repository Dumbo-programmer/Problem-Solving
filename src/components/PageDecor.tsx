import FloatingMath from "./FloatingMath";

/**
 * Ambient retrowave decoration for a page's header strip: a soft neon glow, a
 * few drifting glyphs, and (in dark mode) a faint grid floor. Sits behind the
 * heading with `-z-10`, so pages only need one line to join the theme.
 */

interface PageDecorProps {
  seed?: number;
  count?: number;
  className?: string;
}

export default function PageDecor({ seed = 5, count = 10, className = "" }: PageDecorProps) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden ${className}`}>
      <div className="absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-neon-pink/10 blur-3xl dark:bg-neon-pink/20" />
      <div className="absolute -top-16 right-1/4 h-56 w-56 rounded-full bg-neon-cyan/10 blur-3xl dark:bg-neon-cyan/20" />
      <div className="absolute -top-20 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-neon-violet/10 blur-3xl dark:bg-neon-violet/25" />
      <FloatingMath count={count} seed={seed} className="opacity-60 dark:opacity-80" />
      <div className="absolute inset-x-0 bottom-0 h-40">
        <div className="retro-horizon !h-40 opacity-0 dark:opacity-100" />
      </div>
    </div>
  );
}
