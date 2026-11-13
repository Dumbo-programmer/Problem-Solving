import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Loader2, Trophy, UserRound } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { fetchLeaderboard } from "../lib/api";
import { getClientId } from "../lib/storage";
import { PageHeader } from "../components/Layout";
import LeaderboardList from "../components/LeaderboardList";
import type { LeaderboardWindow, PeriodRow } from "../lib/types";

/**
 * The overall leaderboard: how many problems has each learner solved across
 * every scheduled test? Tabs roll the window (week / month / all time) without
 * changing the metric; the signed-in learner's own row is always highlighted.
 */

const TABS: { key: LeaderboardWindow; label: string }[] = [
  { key: "week", label: "lb.tab.week" },
  { key: "month", label: "lb.tab.month" },
  { key: "all", label: "lb.tab.all" }
];

export default function Leaderboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState<LeaderboardWindow>("all");
  const [rows, setRows] = useState<PeriodRow[] | null>(null);
  const [source, setSource] = useState<"cloud" | "local">("local");
  const clientId = getClientId();
  const accountId = user?.id;

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

  // A learner is "you" when the board row is theirs: server-marked, or the
  // row's owner id matches the signed-in account / this browser.
  const isMe = (row: PeriodRow) =>
    row.isYou || (accountId ? row.clientId === accountId : row.clientId === `anon:${clientId}`);
  const you = useMemo(
    () => rows?.find((r) => isMe(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, accountId, clientId]
  );

  return (
    <div className="shell section-y">
      <PageHeader eyebrow={t("lb.eyebrow")} title={t("lb.title")} description={t("lb.intro")} />

      {/* ---- window tabs + sync state ---- */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-slate-200">
        <div className="flex gap-6">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              type="button"
              onClick={() => setTab(tabDef.key)}
              className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
                tab === tabDef.key
                  ? "border-accent-600 text-ink-900"
                  : "border-transparent text-slate-500 hover:text-ink-900"
              }`}
            >
              {t(tabDef.label)}
            </button>
          ))}
        </div>

        <p className="inline-flex items-center gap-1.5 pb-3 text-xs font-medium text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${source === "cloud" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {source === "cloud" ? t("lb.source.cloud") : t("lb.source.local")}
        </p>
      </div>

      {/* ---- your standing ---- */}
      {rows !== null && (
        <div className="mt-6">
          {you ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-card bg-accent-50 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                <UserRound size={16} className="text-accent-600" />
                {you.name}
              </span>
              <span className="text-sm text-slate-600">
                {t("lb.yourRank", { rank: you.rank, solved: you.correct })}
              </span>
            </div>
          ) : user ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">{t("lb.notRanked")}</p>
              <Link to="/contests" className="btn-primary h-9 px-3.5 text-xs">
                <Trophy size={14} /> {t("nav.contests")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">{t("lb.signedOut")}</p>
              <Link to="/login" className="btn-ghost h-9 px-3.5 text-xs">
                {t("lb.signIn")}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ---- board ---- */}
      {rows === null ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> {t("misc.loading")}
        </div>
      ) : rows.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-20 text-center">
          <Trophy size={28} className="text-slate-300" />
          <p className="max-w-sm text-sm text-slate-500">{t("lb.empty")}</p>
          <Link to="/contests" className="btn-primary mt-2">
            {t("nav.contests")}
          </Link>
        </div>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <LeaderboardList rows={rows.slice(0, 100)} isYou={isMe} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Award size={14} className="text-accent-500" /> {t("lb.hint")}
        </span>
        <Link to="/contests" className="font-medium text-accent-700 hover:text-accent-600">
          {t("nav.contests")} →
        </Link>
      </div>
    </div>
  );
}
