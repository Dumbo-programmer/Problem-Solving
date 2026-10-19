import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Crown, Loader2, Medal, Trophy, UserRound } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { fetchLeaderboard } from "../lib/api";
import PageDecor from "../components/PageDecor";
import { formatDuration } from "../lib/leaderboard";
import { getClientId } from "../lib/storage";
import type { LeaderboardWindow, PeriodRow } from "../lib/types";

/**
 * The overall leaderboard: how many problems has each learner solved across
 * every scheduled test? Tabs roll the window (week / month / all time) without
 * changing the metric; the browser's own row is always highlighted.
 */

const TABS: { key: LeaderboardWindow; label: string }[] = [
  { key: "week", label: "lb.tab.week" },
  { key: "month", label: "lb.tab.month" },
  { key: "all", label: "lb.tab.all" }
];

function rankMedal(rank: number) {
  if (rank === 1) return <Medal size={17} className="text-amber-500" />;
  if (rank === 2) return <Medal size={17} className="text-slate-400" />;
  if (rank === 3) return <Medal size={17} className="text-amber-700/70" />;
  return <span className="font-mono font-bold text-ink-900 dark:text-white">{rank}</span>;
}

export default function Leaderboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState<LeaderboardWindow>("all");
  const [rows, setRows] = useState<PeriodRow[] | null>(null);
  const [source, setSource] = useState<"cloud" | "local">("local");
  const clientId = getClientId();

  useEffect(() => {
    let cancelled = false;
    setRows(null);

    const load = () =>
      void fetchLeaderboard(tab).then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setSource(res.source);
      });

    load();
    const id = window.setInterval(load, 30_000); // keep the board feeling live
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tab]);

  const you = useMemo(() => rows?.find((r) => r.clientId === clientId), [rows, clientId]);

  return (
    <div className="relative">
      <PageDecor seed={4} />
      <div className="shell py-10 lg:py-14">
      <header className="max-w-3xl">
        <p className="eyebrow">{t("lb.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-4xl">
          {t("lb.title")}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t("lb.intro")}</p>
      </header>

      {/* ---- window tabs + sync state ---- */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-ink-800 dark:bg-ink-900/60">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              type="button"
              onClick={() => setTab(tabDef.key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === tabDef.key
                  ? "bg-white text-ink-900 shadow-soft dark:bg-ink-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {t(tabDef.label)}
            </button>
          ))}
        </div>

        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${source === "cloud" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {source === "cloud" ? t("lb.source.cloud") : t("lb.source.local")}
        </p>
      </div>

      {/* ---- your standing ---- */}
      <div className="mt-4">
        {rows === null ? null : you ? (
          <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 border-accent-500/30 bg-accent-500/5 p-4">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-900 dark:text-white">
              <UserRound size={16} className="text-accent-500" /> {you.name}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {t("lb.yourRank", { rank: you.rank, solved: you.correct })}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t("lb.col.tests")}: {you.tests} · {t("lb.col.best")}: {you.bestPct}%
            </span>
          </div>
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("lb.notRanked")}</p>
            <Link to="/tests" className="btn-primary h-9 px-3.5 text-xs">
              <Trophy size={14} /> {t("nav.tests")}
            </Link>
          </div>
        )}
      </div>

      {/* ---- top-3 podium ---- */}
      {rows && rows.length >= 3 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[1, 0, 2].map((idx) => {
            const row = rows[idx];
            if (!row) return null;
            const lane = idx; // 0 = champion, 1 = runner-up, 2 = third
            const isYou = row.clientId === clientId || row.isYou;
            const tone =
              lane === 0
                ? "border-amber-400/60 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-ink-900"
                : lane === 1
                  ? "border-slate-300/70 bg-gradient-to-br from-slate-50 to-white dark:from-ink-800/60 dark:to-ink-900"
                  : "border-orange-300/60 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/25 dark:to-ink-900";
            return (
              <div
                key={row.clientId}
                className={`relative flex flex-col items-center rounded-2xl border p-5 text-center shadow-soft ${tone} ${
                  lane === 0 ? "sm:order-2" : lane === 1 ? "sm:order-1" : "sm:order-3"
                }`}
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br text-white shadow-soft ${
                    lane === 0
                      ? "from-amber-300 to-amber-500"
                      : lane === 1
                        ? "from-slate-300 to-slate-500"
                        : "from-orange-300 to-orange-500"
                  }`}
                >
                  {lane === 0 ? <Crown size={20} /> : <Medal size={20} />}
                </span>
                <span className="mt-3 max-w-full truncate text-sm font-bold text-ink-900 dark:text-white">
                  {row.name}
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t("lb.col.solved")}: <span className="font-mono font-bold text-ink-900 dark:text-white">{row.correct}</span>
                </span>
                <span className="mt-3 rounded-full bg-white/70 px-3 py-1 font-mono text-xs font-bold text-accent-700 shadow-soft dark:bg-ink-900/70 dark:text-accent-300">
                  #{row.rank}
                </span>
                {isYou && (
                  <span className="absolute right-3 top-3 rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-700 dark:text-accent-300">
                    {t("lb.you")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- board ---- */}
      {rows === null ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
        </div>
      ) : rows.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-20 text-center">
          <Trophy size={28} className="text-slate-300 dark:text-slate-600" />
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t("lb.empty")}</p>
          <Link to="/tests" className="btn-primary mt-2">
            {t("nav.tests")}
          </Link>
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto p-0">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 dark:border-ink-800 dark:text-slate-500">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">{t("lb.col.rank")}</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">{t("lb.col.name")}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  {t("lb.col.solved")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  {t("lb.col.tests")}
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider sm:table-cell">
                  {t("lb.col.best")}
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider sm:table-cell">
                  {t("lb.col.time")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((row) => {
                const isYou = row.clientId === clientId || row.isYou;
                return (
                  <tr
                    key={row.clientId}
                    className={`border-b border-slate-100 transition-colors last:border-0 dark:border-ink-800/70 ${
                      isYou ? "bg-accent-500/10" : "hover:bg-slate-50 dark:hover:bg-ink-900/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">{rankMedal(row.rank)}</span>
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-3 font-semibold text-ink-900 dark:text-white">
                      {row.name}
                      {isYou && (
                        <span className="ml-2 rounded bg-accent-500/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-700 dark:text-accent-300">
                          {t("lb.you")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-base font-bold text-ink-900 dark:text-white">
                      {row.correct}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                      {row.tests}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300 sm:table-cell">
                      {row.bestPct}%
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400 sm:table-cell">
                      {formatDuration(row.timeTakenSec)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Award size={14} className="text-accent-500" /> {t("lb.hint")}
        </span>
        <Link to="/tests" className="font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400">
          {t("nav.tests")} →
        </Link>
      </div>
      </div>
    </div>
  );
}
