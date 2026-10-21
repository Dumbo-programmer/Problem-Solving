import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  UserRound
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import PageDecor from "../components/PageDecor";
import { fetchLeaderboard, fetchPastTests, HttpError } from "../lib/api";
import type { PeriodRow, PracticeTest } from "../lib/types";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;
const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,17}$/;

type Mode = "signin" | "signup";

/**
 * One page for both entry points — signing in / creating an account — plus
 * the signed-in "my account" view (rename display name, sign out). Anonymous
 * practice keeps working without an account; the side panel shows the live
 * dashboard and the public leaderboard instead of a wall of marketing copy.
 */
export default function Login() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const mode: Mode = params.get("mode") === "signup" ? "signup" : "signin";
  // Arrived through a route guard? Tell the visitor why they're here.
  const gated = Boolean(params.get("next"));

  return (
    <div className="relative">
      <PageDecor seed={9} count={12} />
      <div className="shell py-10 lg:py-16">
      {gated && !user && (
        <div className="card mb-6 flex items-start gap-3 border-accent-500/40 bg-accent-500/5 p-4">
          <LockKeyhole size={18} className="mt-0.5 shrink-0 text-accent-500" />
          <div>
            <p className="font-semibold text-ink-900">{t("auth.gate.title")}</p>
            <p className="mt-0.5 text-sm text-slate-600">{t("auth.gate.body")}</p>
          </div>
        </div>
      )}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12">
        {user ? <AccountCard locale={locale} /> : <AuthCard mode={mode} />}
        <DashboardPanel />
      </div>
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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    if (isSignup) {
      if (!displayName.trim()) return t("auth.err.name");
      if (!EMAIL_RE.test(email.trim())) return t("auth.err.email");
      if (!PHONE_RE.test(phone.trim())) return t("auth.err.phone");
    }
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
      if (isSignup) {
        await auth.signUp({
          username: username.trim(),
          password,
          displayName: displayName.trim(),
          email: email.trim(),
          phone: phone.trim()
        });
      } else {
        await auth.signIn(username.trim(), password);
      }
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
        className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
      >
        {isSignup ? t("auth.signup.title") : t("auth.signin.title")}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        {isSignup ? t("auth.signup.sub") : t("auth.signin.sub")}
      </p>

      {/* Mode switch */}
      <div className="mt-6 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
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

        {isSignup && (
          <FieldLabel htmlFor="auth-email" hint={t("auth.email.hint")}>
            {t("auth.email")}
            <input
              id="auth-email"
              type="email"
              className="field mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.email.ph")}
              maxLength={254}
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="email"
            />
          </FieldLabel>
        )}

        {isSignup && (
          <FieldLabel htmlFor="auth-phone" hint={t("auth.phone.hint")}>
            {t("auth.phone")}
            <input
              id="auth-phone"
              type="tel"
              className="field mt-1.5"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("auth.phone.ph")}
              maxLength={20}
              autoComplete="tel"
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
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={t("auth.password")}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FieldLabel>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700"
          >
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>          {busy ? (
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
        className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-lg font-bold text-white shadow-soft">
          {me.displayName.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 break-words">{me.displayName}</span>
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="chip border-slate-200 bg-slate-50 font-mono text-slate-700">
          @{me.username}
        </span>
        {me.email && (
          <span className="chip border-slate-200 bg-slate-50 text-slate-700">
            <Mail className="h-3.5 w-3.5" />
            {me.email}
          </span>
        )}
        {me.phone && (
          <span className="chip border-slate-200 bg-slate-50 font-mono text-slate-700">
            <Phone className="h-3.5 w-3.5" />
            {me.phone}
          </span>
        )}
        <span className="chip border-slate-200 bg-white text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" />
          {t("auth.memberSince", { when: since })}
        </span>
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-6">
          <label className="block text-xs font-semibold text-slate-500" htmlFor="rename">
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
            className="btn-quiet text-rose-600 hover:bg-rose-50"
            onClick={() => auth.signOut()}
          >
            <LogOut className="h-4 w-4" />
            {t("nav.signOut")}
          </button>
        </div>
      )}

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <Check className="h-4 w-4" />
          {t("auth.nameSaved")}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
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
/* Side panel — a live dashboard preview                                */
/* ------------------------------------------------------------------ */

/**
 * The panel beside the sign-in form used to explain why an account exists.
 * It now shows the product instead: the learner's own numbers and a live
 * slice of the public leaderboard, so the value of an account is visible
 * before signing up.
 */
function DashboardPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [board, setBoard] = useState<PeriodRow[] | null>(null);
  const [tests, setTests] = useState<PracticeTest[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchLeaderboard("all"), fetchPastTests()]).then(([lb, past]) => {
      if (cancelled) return;
      setBoard(lb.rows);
      setTests(past);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const done = tests.filter((x) => x.status === "SUBMITTED" && x.maxScore > 0);
    const pcts = done.map((x) => Math.round((x.correctCount / x.maxScore) * 100));
    return {
      count: done.length,
      solved: done.reduce((sum, x) => sum + x.correctCount, 0),
      avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
      best: pcts.length ? Math.max(...pcts) : 0
    };
  }, [tests]);

  const top = board?.slice(0, 5) ?? [];
  const you = board?.find((r) => r.isYou);

  const tiles = [
    { label: t("auth.dash.tests"), value: String(stats.count), icon: CalendarDays },
    { label: t("auth.dash.solved"), value: String(stats.solved), icon: Check },
    { label: t("auth.dash.avg"), value: `${stats.avg}%`, icon: Sparkles },
    { label: t("auth.dash.best"), value: `${stats.best}%`, icon: Trophy }
  ];

  return (
    <aside className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 pt-16 shadow-soft sm:p-8 sm:pt-20">
      {/* a single quiet brand glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-200/30 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-32 overflow-hidden">
          <div className="retro-horizon !h-32 opacity-60" />
        </div>
      </div>

      <p className="eyebrow relative">{t("auth.dash.eyebrow")}</p>
      <h2 className="relative mt-2 text-xl font-bold tracking-tight text-slate-900">
        {t("auth.dash.title")}
      </h2>

      {/* ---- your numbers ---- */}
      <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Icon size={12} className="text-accent-500" />
              {label}
            </span>
            <p className="mt-1 font-mono text-xl font-bold text-ink-900">{value}</p>
          </div>
        ))}
      </div>

      {/* ---- your place on the board ---- */}
      {you ? (
        <p className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1.5 text-xs font-semibold text-accent-700">
          <UserRound size={13} />
          {t("auth.dash.rank", { rank: you.rank, solved: you.correct })}
        </p>
      ) : (
        <p className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-medium text-slate-600">
          <ShieldCheck size={13} className="text-accent-500" />
          {user ? t("auth.dash.notRanked") : t("auth.dash.join")}
        </p>
      )}

      {/* ---- live slice of the public board ---- */}
      <div className="relative mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">{t("auth.dash.board")}</h3>
          <span className="chip border border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
            {t("lb.public")}
          </span>
        </div>

        {top.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-600">
            {t("auth.dash.empty")}
          </p>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {top.map((row) => (
              <li
                key={`${row.rank}-${row.clientId}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
              >
                <span className="w-5 shrink-0 font-mono text-xs font-bold text-slate-400">
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                  {row.name}
                </span>
                <span className="shrink-0 font-mono text-xs font-semibold text-accent-600">
                  {row.correct}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Link to="/leaderboard" className="btn-primary relative mt-6 w-full">
        <Trophy size={15} />
        {t("auth.dash.fullBoard")}
      </Link>
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
          ? "bg-white text-accent-700 shadow-soft"
          : "text-slate-500 hover:text-slate-800"
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
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-500">
        {children}
      </label>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

/** Maps an auth failure to a friendly, bilingual message. */
function mapAuthError(err: unknown, t: (key: string) => string): string {
  if (err instanceof HttpError) {
    if (err.code === "username_taken") return t("auth.err.taken");
    if (err.code === "email_taken") return t("auth.err.emailTaken");
    if (err.code === "bad_credentials") return t("auth.err.bad");
    if (err.code === "invalid_username") return t("auth.err.username");
    if (err.code === "invalid_password") return t("auth.err.password");
    if (err.code === "invalid_email") return t("auth.err.email");
    if (err.code === "invalid_phone") return t("auth.err.phone");
    if (err.status === 0 || err.status >= 500) return t("auth.err.offline");
    return t("auth.err.generic");
  }
  // Network-level failure: the API isn't reachable.
  return t("auth.err.offline");
}
