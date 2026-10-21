import { Link } from "react-router-dom";
import { BookOpen, Trophy, UserRound } from "lucide-react";
import { useI18n, TOPIC_LABELS } from "../lib/i18n";
import { CATEGORIES, TOPICS } from "../data/types";
import { PROBLEMS } from "../data";
import BrandLockup from "./BrandLockup";
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
    "text-sm text-slate-600 transition-colors hover:text-accent-600";

  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50/70">
      <div className="shell grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        {/* ---- brand + stats ---- */}
        <div>
          <BrandLockup size="lg" linked={false} />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-600">
            {t("footer.tagline")}
          </p>
          <p className="mt-3 max-w-sm text-xs font-medium text-slate-500">
            {t("footer.partner")}
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="font-mono text-xl font-bold text-ink-900">{stat.value}</dt>
                <dd className="text-xs text-slate-500">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---- explore (topics) ---- */}
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
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
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
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
              <Link to="/contests" className={linkClass}>
                {t("nav.contests")}
              </Link>
            </li>
            <li>
              <Link to="/leaderboard" className={linkClass}>
                {t("nav.leaderboard")}
              </Link>
            </li>
            <li>
              <Link to="/practice#past-tests" className={linkClass}>
                {t("nav.past")}
              </Link>
            </li>
          </ul>
        </div>

        {/* ---- account ---- */}
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
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
              <Link to="/admin" className="text-sm text-slate-400 transition-colors hover:text-accent-600">
                {t("admin.title")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 py-5">
        <div className="shell flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
          <p>{t("misc.copyright", { year })}</p>
          <a
            href="https://www.prothomalo.com/collection/math-school"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-palo/25 bg-palo/5 px-3 py-1.5 font-medium text-palo transition-colors hover:border-palo/50 hover:bg-palo/10"
          >
            <img src="/prothom-alo.svg" alt="" className="h-3.5 w-auto" loading="lazy" decoding="async" />
            {t("footer.partnerShort")}
          </a>
          <p className="text-slate-400">{t("footer.madeFor")}</p>
        </div>
      </div>
    </footer>
  );
}
