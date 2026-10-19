import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  WifiOff
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { HttpError } from "../lib/api";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;
const MIN_PASSWORD = 6;

type Mode = "signin" | "signup";

/**
 * One page for both entry points — signing in / creating an account — plus
 * the signed-in "my account" view (rename display name, sign out). Anonymous
 * practice keeps working without an account; the side panel says so.
 */
export default function Login() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const mode: Mode = params.get("mode") === "signup" ? "signup" : "signin";

  return (
    <div className="shell py-10 lg:py-16">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12">
        {user ? <AccountCard locale={locale} /> : <AuthCard mode={mode} />}
        <PerksPanel t={t} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sign in / create account                                            */
/* ------------------------------------------------------------------ */

function AuthCard({ mode }: { mode: Mode }) {
  const { t } = useI18n();
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isSignup = mode === "signup";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form whenever the tab flips.
  useEffect(() => {
    setError(null);
  }, [mode]);

  const validate = (): string | null => {
    if (!USERNAME_RE.test(username.trim())) return t("auth.err.username");
    if (password.length < MIN_PASSWORD) return t("auth.err.password");
    if (isSignup && !displayName.trim()) return t("auth.err.name");
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (isSignup) await auth.signUp(username.trim(), password, displayName.trim());
      else await auth.signIn(username.trim(), password);
      navigate(params.get("next") || "/", { replace: true });
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="auth-title" className="card relative overflow-hidden p-6 sm:p-8">
      {/* Decorative corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-400/20 blur-3xl"
      />
      <p className="eyebrow">{t("auth.eyebrow")}</p>
      <h1
        id="auth-title"
        className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl"
      >
        {isSignup ? t("auth.signup.title") : t("auth.signin.title")}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {isSignup ? t("auth.signup.sub") : t("auth.signin.sub")}
      </p>

      {/* Mode switch */}
      <div className="mt-6 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-ink-700 dark:bg-ink-900/60">
        <TabLink to="/login" active={!isSignup} icon={LogIn}>
          {t("auth.tab.signin")}
        </TabLink>
        <TabLink to="/login?mode=signup" active={isSignup} icon={UserPlus}>
          {t("auth.tab.signup")}
        </TabLink>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {isSignup && (
          <FieldLabel htmlFor="auth-name" hint={t("auth.displayName.hint")}>
            {t("auth.displayName")}
            <input
              id="auth-name"
              className="field mt-1.5"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("auth.displayName.ph")}
              maxLength={40}
              autoComplete="name"
            />
          </FieldLabel>
        )}

        <FieldLabel htmlFor="auth-username" hint={t("auth.username.hint")}>
          {t("auth.username")}
          <input
            id="auth-username"
            className="field mt-1.5 font-mono"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("auth.username.ph")}
            maxLength={20}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="username"
          />
        </FieldLabel>

        <FieldLabel htmlFor="auth-password" hint={t("auth.password.hint")}>
          {t("auth.password")}
          <div className="relative mt-1.5">
            <input
              id="auth-password"
              type={showPw ? "text" : "password"}
              className="field pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-ink-800 dark:hover:text-slate-300"
              aria-label={t("auth.password")}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FieldLabel>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? (
            t("misc.loading")
          ) : (
            <>
              {isSignup ? t("auth.submit.signup") : t("auth.submit.signin")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* My account (signed in)                                              */
/* ------------------------------------------------------------------ */

function AccountCard({ locale }: { locale: string }) {
  const { t } = useI18n();
  const auth = useAuth();
  const me = auth.user;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me?.displayName ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!me) return null;
  const since = new Date(me.createdAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === me.displayName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await auth.updateName(next);
      setSaved(true);
      setEditing(false);
    } catch {
      /* keep the editor open — the typed value is preserved */
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="account-title" className="card relative overflow-hidden p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-accent-400/20 blur-3xl"
      />
      <p className="eyebrow">{t("auth.account")}</p>
      <h1
        id="account-title"
        className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-lg font-bold text-white shadow-soft">
          {me.displayName.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 break-words">{me.displayName}</span>
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="chip border-slate-200 bg-slate-50 font-mono text-slate-700 dark:border-ink-700 dark:bg-ink-900/60 dark:text-slate-300">
          @{me.username}
        </span>
        <span className="chip border-slate-200 bg-white text-slate-500 dark:border-ink-700 dark:bg-ink-900/40 dark:text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" />
          {t("auth.memberSince", { when: since })}
        </span>
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-6">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="rename">
            {t("auth.displayName")}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="rename"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={saving}>
              <Check className="h-4 w-4" />
              {t("auth.save")}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            {t("auth.displayName")}
          </button>
          <button
            className="btn-quiet text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            onClick={() => auth.signOut()}
          >
            <LogOut className="h-4 w-4" />
            {t("nav.signOut")}
          </button>
        </div>
      )}

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          {t("auth.nameSaved")}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6 dark:border-ink-800">
        <Link to="/tests" className="btn-primary">
          {t("nav.tests")}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link to="/leaderboard" className="btn-ghost">
          <Trophy className="h-4 w-4" />
          {t("nav.leaderboard")}
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Side panel — why an account                                         */
/* ------------------------------------------------------------------ */

function PerksPanel({ t }: { t: (key: string) => string }) {
  const points = [
    { icon: Trophy, text: t("auth.how.point1") },
    { icon: ShieldCheck, text: t("auth.how.point2") },
    { icon: WifiOff, text: t("auth.how.point3") }
  ];
  return (
    <aside className="relative overflow-hidden rounded-3xl border border-accent-200/60 bg-gradient-to-br from-accent-50 via-white to-sky-50 p-6 pt-16 sm:p-8 sm:pt-20 dark:border-accent-900/40 dark:from-ink-900 dark:via-ink-950 dark:to-ink-900">
      {/* Floating maths chips */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        <span className="absolute right-6 top-6 rotate-6 rounded-xl border border-accent-200/70 bg-white/80 px-2.5 py-1 font-mono text-xs font-semibold text-accent-700 shadow-soft dark:border-ink-700 dark:bg-ink-900/80 dark:text-accent-300">
          a² + b² = c²
        </span>
        <span className="absolute right-16 top-24 -rotate-6 rounded-xl border border-sky-200/70 bg-white/80 px-2.5 py-1 font-mono text-xs font-semibold text-sky-700 shadow-soft dark:border-ink-700 dark:bg-ink-900/80 dark:text-sky-300">
          Σ 1/n²
        </span>
        <span className="absolute bottom-10 right-10 rotate-3 rounded-xl border border-amber-200/70 bg-white/80 px-2.5 py-1 font-mono text-xs font-semibold text-amber-700 shadow-soft dark:border-ink-700 dark:bg-ink-900/80 dark:text-amber-300">
          √2 ∉ ℚ
        </span>
      </div>

      <p className="eyebrow relative">{t("auth.eyebrow")}</p>
      <h2 className="relative mt-2 max-w-[16ch] text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
        {t("auth.how.title")}
      </h2>

      <ul className="relative mt-6 space-y-3">
        {points.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/70 p-3 shadow-soft backdrop-blur dark:border-ink-800/60 dark:bg-ink-900/60"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-300">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{text}</span>
          </li>
        ))}
      </ul>

      <p className="relative mt-6 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        <Sparkles className="h-3.5 w-3.5 text-accent-500" />
        {t("misc.footerNote")}
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function TabLink({
  to,
  active,
  icon: Icon,
  children
}: {
  to: string;
  active: boolean;
  icon: typeof LogIn;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-white text-accent-700 shadow-soft dark:bg-ink-800 dark:text-accent-300"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function FieldLabel({
  htmlFor,
  hint,
  children
}: {
  htmlFor: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
        {children}
      </label>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}

/** Maps an auth failure to a friendly, bilingual message. */
function mapAuthError(err: unknown, t: (key: string) => string): string {
  if (err instanceof HttpError) {
    if (err.code === "username_taken") return t("auth.err.taken");
    if (err.code === "bad_credentials") return t("auth.err.bad");
    if (err.code === "invalid_username") return t("auth.err.username");
    if (err.code === "invalid_password") return t("auth.err.password");
    if (err.status === 0 || err.status >= 500) return t("auth.err.offline");
    return t("auth.err.generic");
  }
  // Network-level failure: the API isn't reachable.
  return t("auth.err.offline");
}
