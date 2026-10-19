import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X, Languages } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

const LINKS = [
  { to: "/", key: "nav.home", end: true },
  { to: "/problems", key: "nav.problems", end: false },
  { to: "/practice", key: "nav.practice", end: false },
  { to: "/past-tests", key: "nav.past", end: false }
];

export default function Navbar() {
  const { t, lang, toggle: toggleLang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
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
          ? "border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/85"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="shell flex h-16 items-center justify-between gap-4">
        <Link to="/" className="group flex items-center gap-3" aria-label={t("brand.name")}>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-ink-700 to-ink-900 shadow-soft ring-1 ring-black/5">
            <img src="/logo.png" alt="" className="h-full w-full object-cover" loading="eager" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-ink-900 dark:text-white">
              {t("brand.short")}
            </span>
            <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("brand.tagline")}
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-500/10 text-accent-700 dark:text-accent-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-ink-900 dark:hover:text-white"
                }`
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleLang}
            className="btn-quiet h-9 px-2.5 text-xs"
            aria-label={t("lang.toggle")}
            title={t("lang.toggle")}
          >
            <Languages size={16} />
            <span className="hidden sm:inline">{lang === "bn" ? "EN" : "বাংলা"}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="btn-quiet h-9 w-9 px-0"
            aria-label={t("theme.toggle")}
            title={t("theme.toggle")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <Link to="/practice" className="btn-primary hidden h-9 px-3.5 text-xs sm:inline-flex">
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
        className={`fixed inset-0 top-16 z-30 bg-white transition-opacity duration-200 dark:bg-ink-950 md:hidden ${
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
                    ? "bg-accent-500/10 text-accent-700 dark:text-accent-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-ink-900"
                }`
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
          <Link to="/practice" className="btn-primary mt-3 w-full py-3">
            {t("cta.takeTest")}
          </Link>
        </div>
      </div>
    </header>
  );
}
