import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { TOPIC_LABELS } from "../lib/i18n";
import type { ProblemTopic } from "../lib/types";

export default function Footer() {
  const { t, L } = useI18n();
  const year = new Date().getFullYear();
  const topics: ProblemTopic[] = ["NUMBER_THEORY", "ALGEBRA", "GEOMETRY", "COMBINATORICS", "INEQUALITY", "PROBABILITY"];

  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50/70 dark:border-ink-800 dark:bg-ink-900/40">
      <div className="shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 shadow-soft ring-1 ring-black/5">
              <img src="/logo.png" alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>
            <span className="text-base font-bold tracking-tight text-ink-900 dark:text-white">
              {t("brand.name")}
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t("misc.footerNote")}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {t("home.topicsTitle")}
          </h3>
          <ul className="mt-4 space-y-2.5">
            {topics.map((topic) => (
              <li key={topic}>
                <Link
                  to={`/problems?topic=${topic}`}
                  className="text-sm text-slate-600 transition-colors hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400"
                >
                  {L(TOPIC_LABELS[topic])}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {t("footer.quickLinks")}
          </h3>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/problems" className="text-sm text-slate-600 transition-colors hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400">
                {t("nav.problems")}
              </Link>
            </li>
            <li>
              <Link to="/practice" className="text-sm text-slate-600 transition-colors hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400">
                {t("nav.practice")}
              </Link>
            </li>
            <li>
              <Link to="/past-tests" className="text-sm text-slate-600 transition-colors hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400">
                {t("nav.past")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 py-5 dark:border-ink-800">
        <p className="shell text-center text-xs text-slate-500 dark:text-slate-500">
          {t("misc.copyright", { year })}
        </p>
      </div>
    </footer>
  );
}
