import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Check, Clock, FlaskConical, Loader2, Star, Trash2, Trophy } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { deletePastTest, fetchPastTests, getCloudState, onCloudStateChange } from "../lib/api";
import type { CloudState } from "../lib/api";
import type { PracticeTest } from "../lib/types";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function PastTests() {
  const { t } = useI18n();
  const [tests, setTests] = useState<PracticeTest[] | null>(null);
  const [cloud, setCloud] = useState<CloudState>(() => getCloudState());
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => onCloudStateChange(setCloud), []);

  useEffect(() => {
    let cancelled = false;
    fetchPastTests().then((list) => {
      if (!cancelled) setTests(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    if (!tests || tests.length === 0) return null;
    const submitted = tests.filter((x) => x.status === "SUBMITTED");
    const totalTests = submitted.length;
    const pcts = submitted
      .filter((x) => x.maxScore > 0)
      .map((x) => Math.round((x.correctCount / x.maxScore) * 100));
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const best = pcts.length ? Math.max(...pcts) : 0;
    const solved = submitted.reduce((a, x) => a + x.correctCount, 0);
    return { totalTests, avg, best, solved };
  }, [tests]);

  const remove = async (id: string) => {
    if (!window.confirm(t("past.deleteConfirm"))) return;
    setDeleting(id);
    await deletePastTest(id);
    setTests((prev) => (prev ?? []).filter((x) => x.id !== id));
    setDeleting(null);
  };

  return (
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

      {/* ---- list ---- */}
      {tests === null ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
        </div>
      ) : tests.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-20 text-center">
          <FlaskConical size={28} className="text-slate-300 dark:text-slate-600" />
          <p className="text-lg font-semibold text-ink-900 dark:text-white">{t("past.empty")}</p>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t("past.emptyHint")}</p>
          <Link to="/practice" className="btn-primary mt-2">
            {t("past.create")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tests.map((test) => {
            const pct = test.maxScore > 0 ? Math.round((test.correctCount / test.maxScore) * 100) : 0;
            const done = test.status === "SUBMITTED";
            return (
              <article key={test.id} className="card p-5 transition-shadow hover:shadow-lift">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-bold text-ink-900 dark:text-white">{test.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
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
                        {done ? t("past.statusSubmitted") : t("runner.remaining")}
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
                    onClick={() => remove(test.id)}
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
