import { Link } from "react-router-dom";
import { BookOpen, Trophy, UserRound } from "lucide-react";
import { useI18n, TOPIC_LABELS } from "../lib/i18n";
import { CATEGORIES, TOPICS } from "../data/types";
import { PROBLEMS } from "../data";
import type { ProblemTopic } from "../lib/types";

/**
 * The footer carries the full site map: brand + a small stat strip up top,
 * then three link columns (explore / compete / account) and a slim bottom bar.
 */
export default function Footer() {
  const { t, L } = useI18n();
  const year = new Date().getFullYear();
  const topics: ProblemTopic[] = ["NUMBER_THEORY", "ALGEBRA", "GEOMETRY", "COMBINATORICS", "INEQUALITY", "PROBABILITY"];

  const stats = [
    { value: PROBLEMS.length, label: t("footer.statProblems") },
    { value: TOPICS.length, label: t("footer.statTopics") },
    { value: CATEGORIES.length, label: t("footer.statLevels") }
  ];

  const linkClass =
    "text-sm text-slate-600 transition-colors hover:text-accent-600 dark:text-slate-400 dark:hover:text-accent-400";

  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50/70 dark:border-ink-800 dark:bg-ink-900/40">
      <div className="shell grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        {/* ---- brand + stats ---- */}
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 shadow-soft ring-1 ring-black/5">
              <img src="/logo.png" alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>
            <span className="text-base font-bold tracking-tight text-ink-900 dark:text-white">
              {t("brand.name")}
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t("footer.tagline")}
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="font-mono text-xl font-bold text-ink-900 dark:text-white">{stat.value}</dt>
                <dd className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---- explore (topics) ---- */}
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <BookOpen size={13} /> {t("footer.explore")}
          </h3>
          <ul className="mt-4 space-y-2.5">
            {topics.map((topic) => (
              <li key={topic}>
                <Link to={`/problems?topic=${topic}`} className={linkClass}>
                  {L(TOPIC_LABELS[topic])}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- compete ---- */}
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <Trophy size={13} /> {t("footer.compete")}
          </h3>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/problems" className={linkClass}>
                {t("nav.problems")}
              </Link>
            </li>
            <li>
              <Link to="/practice" className={linkClass}>
                {t("nav.practice")}
              </Link>
            </li>
            <li>
              <Link to="/tests" className={linkClass}>
                {t("nav.tests")}
              </Link>
            </li>
            <li>
              <Link to="/leaderboard" className={linkClass}>
                {t("nav.leaderboard")}
              </Link>
            </li>
            <li>
              <Link to="/past-tests" className={linkClass}>
                {t("nav.past")}
              </Link>
            </li>
          </ul>
        </div>

        {/* ---- account ---- */}
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <UserRound size={13} /> {t("footer.account")}
          </h3>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/login" className={linkClass}>
                {t("nav.signIn")}
              </Link>
            </li>
            <li>
              <Link to="/login?mode=signup" className={linkClass}>
                {t("auth.tab.signup")}
              </Link>
            </li>
            <li>
              <Link to="/leaderboard" className={linkClass}>
                {t("nav.leaderboard")}
              </Link>
            </li>
            <li>
              <Link to="/admin" className="text-sm text-slate-400 transition-colors hover:text-accent-600 dark:text-slate-500 dark:hover:text-accent-400">
                {t("admin.title")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 py-5 dark:border-ink-800">
        <div className="shell flex flex-col items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-500 sm:flex-row">
          <p>{t("misc.copyright", { year })}</p>
          <p className="text-slate-400 dark:text-slate-600">{t("footer.madeFor")}</p>
        </div>
      </div>
    </footer>
  );
}
