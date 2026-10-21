import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FlaskConical,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Trophy,
  UserRound,
  Users
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { CATEGORIES, DIFFICULTIES, TOPICS, TYPES } from "../data/types";
import {
  HttpError,
  adminCredentialStatus,
  adminDeleteProblem,
  adminDeleteTest,
  adminListTests,
  adminOverview,
  adminSaveProblem,
  adminSaveTest,
  adminSubmissions,
  fetchProblems,
  loginAdmin,
  logoutAdmin
} from "../lib/api";
import { readAdminToken } from "../lib/storage";
import PageDecor from "../components/PageDecor";
import { phaseOf } from "../lib/scheduled";
import { formatDuration } from "../lib/leaderboard";
import { DEFAULT_ADMIN_ID, DEFAULT_ADMIN_PASSWORD } from "../lib/adminCredentials";
import type { AdminOverview, AdminSubmission } from "../lib/api";
import type { Problem, ProblemCategory, ProblemDifficulty, ProblemTopic, ProblemType, ScheduledTest, ScheduledTestKind } from "../lib/types";

/**
 * Staff dashboard: sign in with the ADMIN_ID / ADMIN_PASSWORD pair, then
 * create and edit problems, publish weekly/monthly papers, and watch the
 * submissions coming in. The session is an expiring signed token, so there is
 * no user table anywhere.
 */

type Tab = "overview" | "problems" | "tests" | "submissions";

export default function Admin() {
  const { t } = useI18n();
  const [session, setSession] = useState<string | null>(() => readAdminToken());
  const [expired, setExpired] = useState(false);

  if (!session) {
    return (
      <div className="shell flex min-h-[70vh] flex-col items-center justify-center py-10">
        <LoginCard
          expired={expired}
          onLogin={(token) => {
            setExpired(false);
            setSession(token);
          }}
        />
        <p className="mt-6 max-w-md text-center text-xs leading-relaxed text-slate-400">
          {t("admin.login.hint")}
        </p>
      </div>
    );
  }

  return (
    <Dashboard
      onLogout={() => {
        logoutAdmin();
        setSession(null);
      }}
      onExpired={() => {
        logoutAdmin();
        setExpired(true);
        setSession(null);
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

function LoginCard({ expired, onLogin }: { expired: boolean; onLogin: (token: string) => void }) {
  const { t } = useI18n();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // null = unknown (offline), otherwise: is each slot still the documented
  // default? A deployment that replaced them must not display the defaults.
  const [defaults, setDefaults] = useState<{ id: boolean; password: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void adminCredentialStatus()
      .then((res) => {
        if (!cancelled) setDefaults(res);
      })
      .catch(() => {
        /* offline — keep the documented defaults on screen */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(false);
    try {
      await loginAdmin(id, password);
      onLogin(readAdminToken() ?? "");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const showsDefaultId = defaults === null || defaults.id;
  const showsDefaultPassword = defaults === null || defaults.password;

  return (
    <div className="card w-full max-w-sm p-7">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
        <ShieldCheck size={22} />
      </span>
      <p className="eyebrow mt-4">{t("admin.eyebrow")}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{t("admin.title")}</h1>

      {/* ---- which credentials to type ---- */}
      <div className="mt-5 rounded-xl border border-accent-500/25 bg-accent-500/5 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink-900">
          <KeyRound size={13} className="text-accent-500" />
          {t("admin.login.credentials")}
        </p>
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-slate-500">{t("admin.cred.id")}</dt>
          <dd className="font-mono font-semibold text-ink-900">
            {showsDefaultId ? (
              DEFAULT_ADMIN_ID
            ) : (
              <span className="font-sans font-medium text-slate-500">{t("admin.cred.custom")}</span>
            )}
          </dd>
          <dt className="text-slate-500">{t("admin.cred.password")}</dt>
          <dd className="font-mono font-semibold text-ink-900">
            {showsDefaultPassword ? (
              DEFAULT_ADMIN_PASSWORD
            ) : (
              <span className="font-sans font-medium text-slate-500">{t("admin.cred.custom")}</span>
            )}
          </dd>
        </dl>
        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
          {t("admin.login.credentialsHint")}
        </p>
      </div>

      <label className="mt-5 block text-xs font-semibold text-slate-500" htmlFor="admin-id">
        {t("admin.login.id")}
      </label>
      <input
        id="admin-id"
        autoComplete="username"
        value={id}
        onChange={(e) => setId(e.target.value)}
        className="field mt-1.5"
      />

      <label className="mt-4 block text-xs font-semibold text-slate-500" htmlFor="admin-pw">
        {t("admin.login.password")}
      </label>
      <input
        id="admin-pw"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        className="field mt-1.5"
      />

      {(error || expired) && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-rose-500">
          <AlertCircle size={13} /> {expired && !error ? t("admin.expired") : t("admin.login.error")}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !id || !password}
        className="btn-primary mt-5 w-full justify-center py-2.5"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        {t("admin.login.submit")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard shell                                                     */
/* ------------------------------------------------------------------ */

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "admin.tab.overview" },
  { key: "problems", label: "admin.tab.problems" },
  { key: "tests", label: "admin.tab.tests" },
  { key: "submissions", label: "admin.tab.submissions" }
];

/** Weekly / monthly / custom badge for a scheduled paper. */
const KIND_LABEL: Record<ScheduledTestKind, string> = {
  WEEKLY: "kind.weekly",
  MONTHLY: "kind.monthly",
  CUSTOM: "kind.custom"
};

const KIND_CHIP: Record<ScheduledTestKind, string> = {
  WEEKLY: "chip border border-sky-500/40 bg-sky-500/10 text-sky-700",
  MONTHLY: "chip border border-violet-500/40 bg-violet-500/10 text-violet-700",
  CUSTOM: "chip border border-slate-300/70 bg-slate-400/10 text-slate-600"
};

function Dashboard({ onLogout, onExpired }: { onLogout: () => void; onExpired: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="relative">
      <PageDecor seed={12} />
      <div className="shell py-10 lg:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("admin.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {t("admin.title")}
          </h1>
        </div>
        <button type="button" onClick={onLogout} className="btn-quiet h-9 px-3.5 text-xs">
          <LogOut size={14} /> {t("admin.logout")}
        </button>
      </header>

      <div className="mt-6 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {TABS.map((def) => (
          <button
            key={def.key}
            type="button"
            onClick={() => setTab(def.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === def.key
                ? "bg-accent-500/10 text-accent-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {t(def.label)}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewPanel onExpired={onExpired} />}
      {tab === "problems" && <ProblemsPanel onExpired={onExpired} />}
      {tab === "tests" && <TestsPanel onExpired={onExpired} />}
      {tab === "submissions" && <SubmissionsPanel onExpired={onExpired} />}
      </div>
    </div>
  );
}

/** Wrap an admin call so a dead session bounces back to the login card. */
function useGuarded(onExpired: () => void) {
  return useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) onExpired();
        return null;
      }
    },
    [onExpired]
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewPanel({ onExpired }: { onExpired: () => void }) {
  const { t } = useI18n();
  const guard = useGuarded(onExpired);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void guard(adminOverview).then((res) => {
      if (cancelled) return;
      if (res) setData(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [guard]);

  if (loading) {
    return (
      <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
      </p>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Stat icon={FlaskConical} label={t("admin.stat.problems")} value={data?.problems ?? 0} />
      <Stat icon={CalendarDays} label={t("admin.stat.tests")} value={data?.tests ?? 0} />
      <Stat icon={Trophy} label={t("admin.stat.submissions")} value={data?.submissions ?? 0} />
      <Stat icon={Users} label={t("admin.stat.learners")} value={data?.learners ?? 0} />
      <Stat icon={UserRound} label={t("admin.stat.accounts")} value={data?.accounts ?? 0} />
      <div className="col-span-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm sm:col-span-3 lg:col-span-5">
        <RefreshCw size={15} className="text-accent-500" />
        <span className="font-medium text-slate-600">{t("admin.stat.source")}:</span>
        <span className="font-mono font-semibold text-ink-900">
          {data?.source === "postgres" ? t("admin.source.postgres") : t("admin.source.file")}
        </span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="card p-4">
      <Icon size={17} className="text-accent-500" />
      <div className="mt-2 font-mono text-2xl font-bold text-ink-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Problems                                                            */
/* ------------------------------------------------------------------ */

const EMPTY_PROBLEM: Problem = {
  id: "",
  slug: "",
  type: "ACADEMICS",
  topic: "NUMBER_THEORY",
  category: "JUNIOR",
  difficulty: "MEDIUM",
  title: { bn: "", en: "" },
  statement: { bn: "", en: "" },
  answer: "",
  solution: { bn: "", en: "" },
  source: ""
};

function ProblemsPanel({ onExpired }: { onExpired: () => void }) {
  const { t, lang } = useI18n();
  const guard = useGuarded(onExpired);
  const [list, setList] = useState<Problem[] | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetchProblems();
    setList(res.problems);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.title.bn.toLowerCase().includes(q) ||
        p.title.en.toLowerCase().includes(q) ||
        p.answer.toLowerCase().includes(q)
    );
  }, [list, search]);

  const save = async (problem: Problem) => {
    setBusy(true);
    setNotice(null);
    const ok = await guard(() => adminSaveProblem(problem));
    setBusy(false);
    if (ok === null) {
      setNotice({ kind: "err", text: t("admin.error") });
      return;
    }
    setEditing(null);
    setNotice({ kind: "ok", text: t("admin.problems.saved") });
    await refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("admin.confirmProblem"))) return;
    const ok = await guard(() => adminDeleteProblem(id));
    if (ok === null) return;
    setNotice({ kind: "ok", text: t("admin.problems.deleted") });
    await refresh();
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.problems.search")}
          className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-ink-900 outline-none focus:border-accent-500"
        />
        <button type="button" onClick={() => setEditing({ ...EMPTY_PROBLEM })} className="btn-primary h-9 px-3.5 text-xs">
          <Plus size={14} /> {t("admin.problems.new")}
        </button>
      </div>

      {notice && (
        <p
          className={`mt-4 inline-flex items-center gap-1.5 text-xs font-medium ${
            notice.kind === "ok" ? "text-emerald-600" : "text-rose-500"
          }`}
        >
          {notice.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {notice.text}
        </p>
      )}

      {editing && (
        <ProblemEditor
          value={editing}
          busy={busy}
          onSave={(p) => void save(p)}
          onCancel={() => setEditing(null)}
        />
      )}

      {list === null ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
        </p>
      ) : (
        <>
          <p className="mt-5 text-xs text-slate-500">
            {t("admin.problems.count", { n: filtered.length })}
          </p>
          <div className="mt-3 space-y-2">
            {filtered.slice(0, 200).map((p) => (
              <article key={p.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-mono text-xs font-semibold text-accent-600">{p.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                  {lang === "bn" ? p.title.bn : p.title.en}
                </span>
                <span className="chip border border-slate-300/70 text-slate-500">
                  {p.difficulty}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="btn-quiet h-8 px-2.5 text-xs"
                  aria-label={t("admin.problems.edit")}
                >
                  <Pencil size={13} /> {t("admin.problems.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  className="btn-quiet h-8 px-2.5 text-xs text-rose-500 hover:bg-rose-500/10"
                  aria-label={t("admin.problems.delete")}
                >
                  <Trash2 size={13} />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  required
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  const { t } = useI18n();
  const base =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition-colors focus:border-accent-500";
  return (
    <label className="block text-xs font-semibold text-slate-500">
      {label}
      {!required && <span className="ml-1 font-normal italic opacity-70">({t("admin.f.optional")})</span>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={base}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </label>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { key: T; en: string; bn: string }[];
  onChange: (v: T) => void;
}) {
  const { lang } = useI18n();
  return (
    <label className="block text-xs font-semibold text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-accent-500"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {lang === "bn" ? o.bn : o.en}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProblemEditor({
  value,
  busy,
  onSave,
  onCancel
}: {
  value: Problem;
  busy: boolean;
  onSave: (p: Problem) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Problem>(value);
  const [error, setError] = useState(false);

  const patch = (part: Partial<Problem>) => setDraft((d) => ({ ...d, ...part }));

  const submit = () => {
    const complete =
      draft.id.trim() &&
      draft.title.bn.trim() &&
      draft.title.en.trim() &&
      draft.statement.bn.trim() &&
      draft.statement.en.trim() &&
      draft.answer.trim();
    if (!complete) {
      setError(true);
      return;
    }
    setError(false);
    onSave({
      ...draft,
      id: draft.id.trim(),
      slug: draft.slug || draft.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      answer: draft.answer.trim()
    });
  };

  return (
    <div className="card mt-5 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {value.id ? t("admin.problems.edit") : t("admin.problems.newBadge")}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="ID" value={draft.id} onChange={(v) => patch({ id: v })} placeholder="nt-e-15" required />
        <Select label={t("admin.f.type")} value={draft.type} options={TYPES} onChange={(v) => patch({ type: v as ProblemType })} />
        <Select label={t("admin.f.topic")} value={draft.topic} options={TOPICS} onChange={(v) => patch({ topic: v as ProblemTopic })} />
        <Select label={t("admin.f.category")} value={draft.category} options={CATEGORIES} onChange={(v) => patch({ category: v as ProblemCategory })} />
        <Select
          label={t("admin.f.difficulty")}
          value={draft.difficulty}
          options={DIFFICULTIES}
          onChange={(v) => patch({ difficulty: v as ProblemDifficulty })}
        />
        <Field label={t("admin.f.answer")} value={draft.answer} onChange={(v) => patch({ answer: v })} placeholder="65537" required />
        <Field label={t("admin.f.titleBn")} value={draft.title.bn} onChange={(v) => patch({ title: { ...draft.title, bn: v } })} required />
        <Field label={t("admin.f.titleEn")} value={draft.title.en} onChange={(v) => patch({ title: { ...draft.title, en: v } })} required />
        <Field
          label={t("admin.f.statementBn")}
          value={draft.statement.bn}
          onChange={(v) => patch({ statement: { ...draft.statement, bn: v } })}
          multiline
          required
        />
        <Field
          label={t("admin.f.statementEn")}
          value={draft.statement.en}
          onChange={(v) => patch({ statement: { ...draft.statement, en: v } })}
          multiline
          required
        />
        <Field
          label={t("admin.f.solutionBn")}
          value={draft.solution.bn}
          onChange={(v) => patch({ solution: { ...draft.solution, bn: v } })}
          multiline
        />
        <Field
          label={t("admin.f.solutionEn")}
          value={draft.solution.en}
          onChange={(v) => patch({ solution: { ...draft.solution, en: v } })}
          multiline
        />
        <Field label={t("admin.f.source")} value={draft.source} onChange={(v) => patch({ source: v })} />
      </div>

      {error && <p className="mt-3 text-xs font-medium text-rose-500">{t("admin.problems.invalid")}</p>}

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="btn-primary h-9 px-4 text-xs">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t("admin.problems.save")}
        </button>
        <button type="button" onClick={onCancel} className="btn-quiet h-9 px-3.5 text-xs">
          {t("admin.problems.cancel")}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scheduled tests                                                     */
/* ------------------------------------------------------------------ */

const EMPTY_TEST: ScheduledTest = {
  id: "",
  kind: "WEEKLY",
  title: { bn: "", en: "" },
  description: { bn: "", en: "" },
  startAt: new Date().toISOString(),
  endAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  durationMin: 45,
  problemIds: [],
  published: true
};

/** ISO ⇄ datetime-local (the input works in local time). */
const toInput = (iso: string): string => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** datetime-local value → ISO ("" when the field is cleared/invalid). */
const inputToIso = (value: string): string => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
};

const candidateTitleOk = (test: ScheduledTest): boolean =>
  Boolean(test.title.bn.trim() && test.title.en.trim());

function TestsPanel({ onExpired }: { onExpired: () => void }) {
  const { t, L, lang } = useI18n();
  const guard = useGuarded(onExpired);
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const [list, setList] = useState<ScheduledTest[] | null>(null);
  const [editing, setEditing] = useState<ScheduledTest | null>(null);
  const [idsText, setIdsText] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await guard(adminListTests);
    if (res) setList(res.tests);
  }, [guard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    if (!editing) return;
    const problemIds = idsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const startMs = Date.parse(editing.startAt);
    const endMs = Date.parse(editing.endAt);

    if (
      !candidateTitleOk(editing) ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs ||
      problemIds.length === 0
    ) {
      setNotice({ kind: "err", text: t("admin.tests.invalid") });
      return;
    }

    const candidate: ScheduledTest = {
      ...editing,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(endMs).toISOString(),
      problemIds
    };

    setBusy(true);
    setNotice(null);
    const ok = await guard(() => adminSaveTest(candidate));
    setBusy(false);
    if (ok === null) {
      setNotice({ kind: "err", text: t("admin.error") });
      return;
    }
    setEditing(null);
    setNotice({ kind: "ok", text: t("admin.tests.saved") });
    await refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("admin.tests.confirm"))) return;
    const ok = await guard(() => adminDeleteTest(id));
    if (ok === null) return;
    setNotice({ kind: "ok", text: t("admin.tests.deleted") });
    await refresh();
  };

  const openEditor = (test: ScheduledTest) => {
    setEditing(test);
    setIdsText(test.problemIds.join(", "));
    setNotice(null);
  };

  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{t("admin.tests.count", { n: list?.length ?? 0 })}</p>
        <button
          type="button"
          onClick={() => openEditor({ ...EMPTY_TEST, id: `custom-${Date.now().toString(36)}` })}
          className="btn-primary h-9 px-3.5 text-xs"
        >
          <Plus size={14} /> {t("admin.tests.new")}
        </button>
      </div>

      {notice && (
        <p
          className={`mt-4 inline-flex items-center gap-1.5 text-xs font-medium ${
            notice.kind === "ok" ? "text-emerald-600" : "text-rose-500"
          }`}
        >
          {notice.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {notice.text}
        </p>
      )}

      {editing && (
        <div className="card mt-5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {t("admin.tests.edit")}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select
              label={t("admin.f.kind")}
              value={editing.kind}
              options={[
                { key: "WEEKLY" as ScheduledTestKind, en: "Weekly", bn: "সাপ্তাহিক" },
                { key: "MONTHLY" as ScheduledTestKind, en: "Monthly", bn: "মাসিক" },
                { key: "CUSTOM" as ScheduledTestKind, en: "Custom", bn: "কাস্টম" }
              ]}
              onChange={(v) => setEditing({ ...editing, kind: v as ScheduledTestKind })}
            />
            <Field label={t("admin.f.durationMin")} value={String(editing.durationMin)} onChange={(v) => setEditing({ ...editing, durationMin: Number(v) || 45 })} />
            <Field
              label={t("admin.f.titleBn")}
              value={editing.title.bn}
              onChange={(v) => setEditing({ ...editing, title: { ...editing.title, bn: v } })}
              required
            />
            <Field
              label={t("admin.f.titleEn")}
              value={editing.title.en}
              onChange={(v) => setEditing({ ...editing, title: { ...editing.title, en: v } })}
              required
            />
            <Field
              label={t("admin.f.descBn")}
              value={editing.description.bn}
              onChange={(v) => setEditing({ ...editing, description: { ...editing.description, bn: v } })}
            />
            <Field
              label={t("admin.f.descEn")}
              value={editing.description.en}
              onChange={(v) => setEditing({ ...editing, description: { ...editing.description, en: v } })}
            />
            <label className="block text-xs font-semibold text-slate-500">
              {t("admin.f.start")}
              <input
                type="datetime-local"
                value={toInput(editing.startAt)}
                onChange={(e) => setEditing({ ...editing, startAt: inputToIso(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-accent-500"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              {t("admin.f.end")}
              <input
                type="datetime-local"
                value={toInput(editing.endAt)}
                onChange={(e) => setEditing({ ...editing, endAt: inputToIso(e.target.value) })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-accent-500"
              />
            </label>
            <div className="sm:col-span-2">
              <Field
                label={t("admin.f.problemIds")}
                value={idsText}
                onChange={setIdsText}
                placeholder="nt-e-01, al-m-04, gd-h-02"
                multiline
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={editing.published}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                className="h-4 w-4 accent-accent-500"
              />
              {t("admin.f.published")}
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => void save()} disabled={busy} className="btn-primary h-9 px-4 text-xs">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t("admin.tests.save")}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn-quiet h-9 px-3.5 text-xs">
              {t("admin.problems.cancel")}
            </button>
          </div>
        </div>
      )}

      {list === null ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {list.map((test) => {
            const phase = phaseOf(test);
            return (
              <article key={test.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-mono text-xs font-semibold text-accent-600">{test.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                  {L(test.title)}
                </span>
                <span className="text-xs text-slate-500">
                  {fmtWhen(test.startAt)} → {fmtWhen(test.endAt)}
                </span>
                <span className={KIND_CHIP[test.kind]}>{t(KIND_LABEL[test.kind])}</span>
                <span
                  className={`chip border ${
                    test.published
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      : "border-slate-400/40 bg-slate-400/10 text-slate-500"
                  }`}
                >
                  {test.published ? t(`tests.phase.${phase}`) : t("admin.f.draft")}
                </span>
                <button type="button" onClick={() => openEditor(test)} className="btn-quiet h-8 px-2.5 text-xs">
                  <Pencil size={13} /> {t("admin.problems.edit")}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(test.id)}
                  className="btn-quiet h-8 px-2.5 text-xs text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 size={13} />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Submissions                                                         */
/* ------------------------------------------------------------------ */

function SubmissionsPanel({ onExpired }: { onExpired: () => void }) {
  const { t, lang } = useI18n();
  const guard = useGuarded(onExpired);
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const [rows, setRows] = useState<AdminSubmission[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void guard(adminSubmissions).then((res) => {
      if (!cancelled && res) setRows(res.submissions);
    });
    return () => {
      cancelled = true;
    };
  }, [guard]);

  if (rows === null) {
    return (
      <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="mt-8 text-sm text-slate-500">{t("admin.submissions.empty")}</p>;
  }

  return (
    <div className="card mt-6 overflow-x-auto p-0">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-400">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">{t("lb.col.name")}</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">{t("admin.tab.tests")}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">{t("lb.col.score")}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">{t("lb.col.time")}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
              {t("admin.submissions.col.date")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.entryId} className="border-b border-slate-100 last:border-0">
              <td className="max-w-[12rem] truncate px-4 py-3 font-medium text-ink-900">{row.name}</td>
              <td className="max-w-[16rem] truncate px-4 py-3 text-slate-600">{row.testTitle}</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-ink-900">
                {row.pct}% <span className="font-normal text-slate-400">({row.score}/{row.maxScore})</span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-500">
                {formatDuration(row.timeTakenSec)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
                {new Date(row.submittedAt).toLocaleString(locale, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
