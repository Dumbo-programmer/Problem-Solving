import { Link } from "react-router-dom";
import { Facebook, Globe } from "lucide-react";
import { useI18n, TOPIC_LABELS } from "../lib/i18n";
import BrandLockup from "./BrandLockup";
import type { ProblemTopic } from "../lib/types";

/**
 * A quiet footer: brand and tagline, three short link columns, then the
 * copyright line. No stats and no decorative panels.
 */
export default function Footer() {
  const { t, L } = useI18n();
  const year = new Date().getFullYear();

  const topics: { topic: ProblemTopic; href: string }[] = [
    { topic: "NUMBER_THEORY", href: "https://www.prothomalo.com/collection/number-theory-math-school" },
    { topic: "GEOMETRY", href: "https://www.prothomalo.com/collection/number-theory-math-school" },
    { topic: "ALGEBRA", href: "https://www.prothomalo.com/collection/algebra-math-school" },
    { topic: "PROBABILITY", href: "https://www.prothomalo.com/collection/probability-math-school" }
  ];

  const linkClass = "text-sm text-slate-600 transition-colors hover:text-accent-700";
  const headingClass = "text-xs font-semibold uppercase tracking-[0.18em] text-slate-400";

  return (
    <footer className="mt-20 border-t border-slate-200">
      <div className="shell grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        {/* ---- brand ---- */}
        <div>
          <BrandLockup size="lg" linked={false} />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-600">
            {t("footer.tagline")}
          </p>
          <p className="mt-3 max-w-sm text-xs font-medium text-slate-500">
            {t("footer.partner")}
          </p>

          <div className="mt-5 flex items-center gap-1">
            <a
              href="https://www.facebook.com/PA.GonitIshkul"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink-900"
              aria-label="Facebook"
            >
              <Facebook size={17} strokeWidth={1.75} />
            </a>
            <a
              href="https://www.prothomalo.com/collection/math-school"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink-900"
              aria-label={t("footer.visitPalo")}
            >
              <Globe size={17} strokeWidth={1.75} />
            </a>
          </div>
        </div>

        {/* ---- explore ---- */}
        <div>
          <h3 className={headingClass}>{t("footer.explore")}</h3>
          <ul className="mt-4 space-y-2.5">
            {topics.map(({ topic, href }) => (
              <li key={topic}>
                <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {L(TOPIC_LABELS[topic])}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- compete ---- */}
        <div>
          <h3 className={headingClass}>{t("footer.compete")}</h3>
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
          <h3 className={headingClass}>{t("footer.account")}</h3>
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
              <Link to="/admin" className="text-sm text-slate-400 transition-colors hover:text-accent-700">
                {t("admin.title")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 py-5">
        <div className="shell flex flex-col items-center justify-between gap-3 text-xs text-slate-500 sm:flex-row">
          <p>{t("misc.copyright", { year })}</p>
          <p className="text-slate-400">{t("footer.madeFor")}</p>
          <a
            href="https://www.prothomalo.com/collection/math-school"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-slate-500 transition-colors hover:text-accent-700"
          >
            <img src="/prothom-alo.svg" alt="" className="h-3.5 w-auto" loading="lazy" decoding="async" />
            {t("footer.partnerShort")}
          </a>
        </div>
      </div>
    </footer>
  );
}
