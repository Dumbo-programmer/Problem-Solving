import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, Languages, Menu, Swords, Timer, UserRound, X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import BrandLockup from "./BrandLockup";

/**
 * A slim navigation bar: brand on the left, the four places a learner needs
 * in the middle, and two quiet utilities on the right. Each destination keeps
 * its icon so the bar scans quickly without turning into a row of chips.
 *
 * The logo links home, so "Home" is not repeated as a link.
 */
const LINKS = [
  { to: "/problems", key: "nav.problems", icon: BookOpen },
  { to: "/practice", key: "nav.practice", icon: Timer },
  { to: "/contests", key: "nav.contests", icon: Swords },
  { to: "/leaderboard", key: "nav.leaderboard", icon: BarChart3 }
] as const;

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function Navbar() {
  const { t, lang, toggle: toggleLang } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile sheet whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#fdfcfa]/90 backdrop-blur">
      <nav className="shell flex h-20 items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLockup size="sm" />
          <span className="hidden h-9 w-px bg-slate-200 lg:block" aria-hidden />
          <span className="hidden text-sm font-semibold text-slate-500 lg:block">
            {t("brand.tagline")}
          </span>
        </div>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors ${
                  isActive ? "text-accent-700" : "text-slate-600 hover:text-ink-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <link.icon
                    size={16}
                    strokeWidth={1.75}
                    className={isActive ? "text-accent-600" : "text-slate-400"}
                  />
                  {t(link.key)}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink-900"
            aria-label={t("lang.toggle")}
            title={t("lang.toggle")}
          >
            <Languages size={16} strokeWidth={1.75} />
            <span className="hidden sm:inline">{lang === "bn" ? "EN" : "বাংলা"}</span>
          </button>

          {user ? (
            <Link
              to="/login"
              className="hidden max-w-[12rem] items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:inline-flex"
              title={t("auth.signedInAs", { name: user.displayName })}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-600 text-[10px] font-bold text-white">
                {initials(user.displayName)}
              </span>
              <span className="truncate">{user.displayName}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink-900 sm:inline-flex"
            >
              <UserRound size={16} strokeWidth={1.75} className="text-slate-400" />
              {t("nav.signIn")}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink-900 md:hidden"
            aria-label={open ? t("nav.close") : t("nav.menu")}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <div
        className={`fixed inset-0 top-20 z-30 bg-[#fdfcfa] transition-opacity duration-200 md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="shell flex flex-col py-4">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 border-b border-slate-100 py-3.5 text-base font-medium transition-colors ${
                  isActive ? "text-accent-700" : "text-slate-700 hover:text-ink-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <link.icon
                    size={18}
                    strokeWidth={1.75}
                    className={isActive ? "text-accent-600" : "text-slate-400"}
                  />
                  {t(link.key)}
                </>
              )}
            </NavLink>
          ))}

          <div className="mt-6 flex flex-col gap-3">
            {user ? (
              <Link
                to="/login"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-600 text-[11px] font-bold text-white">
                  {initials(user.displayName)}
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-ink-900">
                  {user.displayName}
                </span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700"
              >
                <UserRound size={16} strokeWidth={1.75} className="text-slate-400" />
                {t("nav.signIn")}
              </Link>
            )}

            <Link to="/practice" className="btn-primary w-full py-3">
              {t("cta.takeTest")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
