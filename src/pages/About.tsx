import { Link } from "react-router-dom";
import { ArrowRight, Database, Github, Layers, Server, Sparkles } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { CATEGORIES, DIFFICULTIES, TOPICS, TYPES } from "../data/types";
import Reveal from "../components/Reveal";

export default function About() {
  const { t, L } = useI18n();

  const stack = [
    { icon: Sparkles, name: "React + Vite + TypeScript", note: "Fast, static-first front end." },
    { icon: Layers, name: "Tailwind CSS", note: "Design system with a light & dark theme." },
    { icon: Server, name: "Netlify Functions", note: "Serverless API that fronts the database." },
    { icon: Database, name: "Supabase (PostgreSQL)", note: "Stores the problem bank and your results." }
  ];

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-2xl">
        <p className="eyebrow">{t("nav.about")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
          {t("about.title")}
        </h1>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4 text-[16px] leading-relaxed text-slate-700 dark:text-slate-300">
          <p>{t("about.p1")}</p>
          <p>{t("about.p2")}</p>
          <p>{t("about.p3")}</p>

          <div className="pt-4">
            <Link to="/practice" className="btn-primary">
              {t("hero.ctaPrimary")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <aside className="card p-5">
          <h2 className="text-sm font-bold text-ink-900 dark:text-white">{t("about.stack")}</h2>
          <ul className="mt-4 space-y-4">
            {stack.map((s) => (
              <li key={s.name} className="flex gap-3">
                <s.icon size={17} className="mt-0.5 shrink-0 text-accent-500" />
                <div>
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">{s.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.note}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-ink-800">
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400"
            >
              <Github size={15} /> GitHub
            </a>
          </div>
        </aside>
      </div>

      {/* ---- taxonomy reference ---- */}
      <section className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal>
          <div className="card h-full p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-white">{t("filter.type")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {TYPES.map((x) => (
                <li key={x.key}>{L(x)}</li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={70}>
          <div className="card h-full p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-white">{t("filter.category")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {CATEGORIES.map((x) => (
                <li key={x.key} className="flex items-baseline justify-between gap-2">
                  <span>{L(x)}</span>
                  <span className="font-mono text-xs text-slate-400">{x.grades}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div className="card h-full p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-white">{t("filter.difficulty")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {DIFFICULTIES.map((x) => (
                <li key={x.key}>{L(x)}</li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={210}>
          <div className="card h-full p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-white">{t("filter.topic")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {TOPICS.map((x) => (
                <li key={x.key}>{L(x)}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
