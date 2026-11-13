import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";

/**
 * Shared page furniture.
 *
 * One centred content column, one vertical rhythm, one heading scale — pages
 * compose these instead of re-inventing spacing and type on every screen.
 */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`shell ${className}`}>{children}</div>;
}

interface SectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
  /** Hairline rules top and bottom, for a band that separates two sections. */
  bordered?: boolean;
}

export function Section({ children, id, className = "", bordered = false }: SectionProps) {
  return (
    <section id={id} className={`section-y ${bordered ? "border-y border-slate-200" : ""} ${className}`}>
      <div className="shell">{children}</div>
    </section>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-4 ${className}`}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-3 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

interface SectionHeadingProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({ title, description, action, className = "" }: SectionHeadingProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-4 ${className}`}>
      <div className="max-w-xl">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
        {description && <p className="mt-3 text-slate-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface Stat {
  value: ReactNode;
  label: string;
}

export function StatsStrip({ items, className = "" }: { items: Stat[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 ${className}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="font-mono text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {item.value}
          </dt>
          <dd className="mt-1.5 text-sm leading-snug text-slate-500">{item.label}</dd>
        </div>
      ))}
    </dl>
  );
}

interface FeatureRowProps {
  icon: LucideIcon;
  title: string;
  body: string;
  to: string;
  cta: string;
  /** Put the illustration on the left instead of the right. */
  flip?: boolean;
}

export function FeatureRow({ icon: Icon, title, body, to, cta, flip = false }: FeatureRowProps) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
      <div className={flip ? "md:order-2" : ""}>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-card border border-slate-200 bg-white text-accent-600">
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <h3 className="mt-5 text-2xl font-bold tracking-tight text-ink-900">{title}</h3>
        <p className="mt-3 max-w-md leading-relaxed text-slate-600">{body}</p>
        <Link
          to={to}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-600"
        >
          {cta}
          <ArrowRight size={15} strokeWidth={1.75} />
        </Link>
      </div>

      <div
        className={`flex min-h-[11rem] items-center justify-center rounded-panel border border-slate-200 bg-slate-50/70 ${
          flip ? "md:order-1" : ""
        }`}
        aria-hidden
      >
        <Icon size={48} strokeWidth={1.25} className="text-slate-300" />
      </div>
    </div>
  );
}
