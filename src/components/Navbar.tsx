import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, UserRound, X, Languages } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import BrandLockup from "./BrandLockup";

/**
 * Nav links, ordered by how much a visitor needs them.
 *
 * "Practice" is deliberately absent — the primary CTA on the right already
 * leads there, and the past-test archive lives on that same page.
 */
const LINKS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/problems", key: "nav.problems", end: false },
  { to: "/leaderboard", key: "nav.leaderboard", end: false },
  { to: "/contests", key: "nav.contests", end: false }
] as const;

export default function Navbar() {
  const { t, lang, toggle: toggleLang } = useI18n();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Close the mobile sheet whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="shell flex h-24 items-center justify-between gap-4">
        <BrandLockup size="sm" />

        <div className="hidden items-center gap-0.5 md:flex lg:gap-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm ${
                  isActive
                    ? "bg-accent-500/10 text-accent-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleLang}
            className="btn-quiet h-9 px-2.5 text-xs"
            aria-label={t("lang.toggle")}
            title={t("lang.toggle")}
          >
            <Languages size={16} />
            <span className="hidden lg:inline">{lang === "bn" ? "EN" : "বাংলা"}</span>
          </button>

          {user ? (
            <>
              <Link
                to="/login"
                className="btn-quiet hidden h-9 max-w-[11rem] px-2 text-xs md:inline-flex"
                title={t("auth.signedInAs", { name: user.displayName })}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-600 text-[10px] font-bold text-white">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate">{user.displayName}</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="btn-quiet hidden h-9 w-9 px-0 sm:inline-flex"
                aria-label={t("nav.signOut")}
                title={t("nav.signOut")}
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-quiet hidden h-9 whitespace-nowrap px-3 text-xs sm:inline-flex">
              <UserRound size={16} />
              {t("nav.signIn")}
            </Link>
          )}

          <Link
            to="/practice"
            className={`btn-primary hidden h-9 whitespace-nowrap px-3.5 text-xs sm:inline-flex ${
              location.pathname === "/practice" ? "ring-2 ring-accent-300" : ""
            }`}
          >
            {t("nav.practice")}
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-quiet h-9 w-9 px-0 md:hidden"
            aria-label={open ? t("nav.close") : t("nav.menu")}
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <div
        className={`fixed inset-0 top-24 z-30 bg-white transition-opacity duration-200 md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="shell flex flex-col gap-1 py-4">
          {LINKS.map((link, i) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              style={{ transitionDelay: `${i * 30}ms` }}
              className={({ isActive }) =>
                `rounded-xl px-4 py-3.5 text-base font-medium transition-all ${
                  open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                } ${
                  isActive
                    ? "bg-accent-500/10 text-accent-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
          {user ? (
            <div
              style={{ transitionDelay: `${LINKS.length * 30}ms` }}
              className={`mt-1 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 transition-all ${
                open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-[11px] font-bold text-white">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate text-sm font-semibold text-slate-800">
                  {user.displayName}
                </span>
              </span>
              <button
                type="button"
                onClick={signOut}
                className="btn-quiet shrink-0 text-xs text-rose-600"
              >
                <LogOut size={14} />
                {t("nav.signOut")}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              style={{ transitionDelay: `${LINKS.length * 30}ms` }}
              className={`rounded-xl px-4 py-3.5 text-base font-medium transition-all ${
                open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              } text-slate-700 hover:bg-slate-100`}
            >
              {t("nav.signIn")}
            </Link>
          )}
          <Link to="/practice" className="btn-primary mt-3 w-full py-3">
            {t("cta.takeTest")}
          </Link>
        </div>
      </div>
    </header>
  );
}
