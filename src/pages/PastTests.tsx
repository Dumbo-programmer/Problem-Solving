import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  FlaskConical,
  Loader2,
  Star,
  Trash2,
  Trophy
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import {
  deletePastTest,
  fetchPastTests,
  fetchScheduledTests,
  getCloudState,
  onCloudStateChange
} from "../lib/api";
import type { CloudState } from "../lib/api";
import PageDecor from "../components/PageDecor";
import { attemptKind, type AttemptKind } from "../lib/scheduled";
import type { PracticeTest, ScheduledTest } from "../lib/types";

/** Which slice of the archive is on screen. */
type Filter = "all" | AttemptKind;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "past.filter.all" },
  { key: "weekly", label: "kind.weekly" },
  { key: "monthly", label: "kind.monthly" },
  { key: "practice", label: "past.filter.practice" }
];

/** Badge colours per kind — the archive should be readable at a glance. */
const KIND_CHIP: Record<AttemptKind, string> = {
  weekly: "chip border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  monthly: "chip border border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  scheduled: "chip border border-accent-500/40 bg-accent-500/10 text-accent-700 dark:text-accent-300",
  practice: "chip border border-slate-300/70 bg-slate-400/10 text-slate-600 dark:border-ink-700 dark:text-slate-300"
};

export default function PastTests() {
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-GB";
  const [tests, setTests] = useState<PracticeTest[] | null>(null);
  const [papers, setPapers] = useState<ScheduledTest[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [cloud, setCloud] = useState<CloudState>(() => getCloudState());
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => onCloudStateChange(setCloud), []);

  useEffect(() => {
    let cancelled = false;
    fetchPastTests().then((list) => {
      if (!cancelled) setTests(list);
    });
    // The scheduled papers tell us which attempts were weekly/monthly.
    void fetchScheduledTests().then((res) => {
      if (!cancelled) setPapers(res.tests);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fmtDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  };

  /** Every attempt with its kind resolved. */
  const rows = useMemo(
    () => (tests ?? []).map((test) => ({ test, kind: attemptKind(test, papers) })),
    [tests, papers]
  );

  const counts = useMemo(() => {
    const map: Record<AttemptKind, number> = { weekly: 0, monthly: 0, scheduled: 0, practice: 0 };
    for (const row of rows) map[row.kind] += 1;
    return map;
  }, [rows]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.kind === filter)),
    [rows, filter]
  );

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const submitted = rows.filter((r) => r.test.status === "SUBMITTED");
    const pcts = submitted
      .filter((r) => r.test.maxScore > 0)
      .map((r) => Math.round((r.test.correctCount / r.test.maxScore) * 100));
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const best = pcts.length ? Math.max(...pcts) : 0;
    const solved = submitted.reduce((a, r) => a + r.test.correctCount, 0);
    return { totalTests: submitted.length, avg, best, solved };
  }, [rows]);

  const remove = async (id: string) => {
    if (!window.confirm(t("past.deleteConfirm"))) return;
    setDeleting(id);
    await deletePastTest(id);
    setTests((prev) => (prev ?? []).filter((x) => x.id !== id));
    setDeleting(null);
  };

  return (
    <div className="relative">
      <PageDecor seed={8} />
      <div className="shell py-10 lg:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">{t("nav.past")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
            {t("past.title")}
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">{t("past.lede")}</p>
        </div>
        <Link to="/practice" className="btn-primary">
          {t("nav.practice")} <ArrowRight size={16} />
        </Link>
      </header>

      {/* ---- summary strip ---- */}
      {summary && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={FlaskConical} label={t("past.totalTests")} value={String(summary.totalTests)} />
          <SummaryCard icon={Trophy} label={t("past.avgScore")} value={`${summary.avg}%`} />
          <SummaryCard icon={Star} label={t("past.bestScore")} value={`${summary.best}%`} />
          <SummaryCard icon={Check} label={t("past.totalCorrect")} value={String(summary.solved)} />
        </div>
      )}

      {/* ---- sync state ---- */}
      <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span
          className={`h-1.5 w-1.5 rounded-full ${cloud === "online" ? "bg-emerald-500" : "bg-amber-500"}`}
        />
        {cloud === "online" ? t("past.cloudSync") : t("past.localOnly")}
      </p>

      {/* ---- filters: weekly / monthly / built by you ---- */}
      {rows.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const count =
              f.key === "all" ? rows.length : counts[f.key as AttemptKind];
            if (f.key !== "all" && count === 0) return null;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`chip border transition-colors ${
                  active
                    ? "border-accent-500/50 bg-accent-500/10 text-accent-700 dark:text-accent-300"
                    : "border-slate-200 bg-white text-slate-500 hover:text-slate-800 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {t(f.label)}
                <span className="font-mono text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ---- list ---- */}
      {tests === null ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
        </div>
      ) : rows.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-20 text-center">
          <FlaskConical size={28} className="text-slate-300 dark:text-slate-600" />
          <p className="text-lg font-semibold text-ink-900 dark:text-white">{t("past.empty")}</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t("past.emptyHint")}</p>
          <Link to="/practice" className="btn-primary mt-2">
            {t("past.create")}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <CalendarRange size={26} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("past.filterEmpty")}</p>
          <button type="button" onClick={() => setFilter("all")} className="btn-ghost h-9 px-3.5 text-xs">
            {t("past.filter.all")}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {visible.map(({ test, kind }) => {
            const pct = test.maxScore > 0 ? Math.round((test.correctCount / test.maxScore) * 100) : 0;
            const done = test.status === "SUBMITTED";
            return (
              <article key={test.id} className="card p-5 transition-shadow hover:shadow-lift">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-bold text-ink-900 dark:text-white">{test.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {/* Where the paper came from: a scheduled sprint or the learner. */}
                      <span className={KIND_CHIP[kind]}>
                        {kind === "practice" ? t("past.source.practice") : t(`kind.${kind === "scheduled" ? "custom" : kind}`)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={13} /> {fmtDate(test.startedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FlaskConical size={13} /> {test.problemIds.length} {t("past.questions")}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} /> {test.durationMin} {t("builder.minutesShort")}
                      </span>
                      <span
                        className={`chip border ${
                          done
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {done ? t("past.statusSubmitted") : t("past.statusInProgress")}
                      </span>
                    </div>
                  </div>

                  {done && (
                    <div className="text-right">
                      <div className="font-mono text-3xl font-extrabold leading-none text-ink-900 dark:text-white">
                        {pct}%
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {test.correctCount}/{test.maxScore}
                      </p>
                    </div>
                  )}
                </div>

                {done && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800">
                    <div
                      className={`h-full rounded-full ${
                        pct >= 60
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : pct >= 40
                            ? "bg-gradient-to-r from-amber-500 to-amber-400"
                            : "bg-gradient-to-r from-rose-500 to-rose-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/test/${test.id}/results`} className="btn-ghost h-9 px-3 text-xs">
                    {t("action.viewResults")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(test.id)}
                    disabled={deleting === test.id}
                    className="btn-quiet h-9 px-3 text-xs text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} /> {t("past.delete")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof FlaskConical;
  label: string;
  value: string;
}) {
  return (
    <div className="card p-4">
      <Icon size={17} className="text-accent-500" />
      <div className="mt-2 font-mono text-2xl font-bold text-ink-900 dark:text-white">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
