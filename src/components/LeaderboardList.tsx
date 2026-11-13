import { useI18n } from "../lib/i18n";
import { shortId } from "../lib/leaderboard";
import type { PeriodRow } from "../lib/types";

/**
 * The compact board row, shared by the home preview and the full leaderboard.
 * Rank, name and a muted handle on the left; the bold metric and a quiet
 * secondary line on the right. No table chrome.
 */

interface LeaderboardListProps {
  rows: PeriodRow[];
  isYou?: (row: PeriodRow) => boolean;
  className?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function LeaderboardList({ rows, isYou, className = "" }: LeaderboardListProps) {
  const { t } = useI18n();

  return (
    <ol className={`divide-y divide-slate-100 ${className}`}>
      {rows.map((row) => {
        const mine = isYou ? isYou(row) : row.isYou;
        const top = row.rank <= 3;
        return (
          <li
            key={row.clientId}
            className={`flex items-center gap-3 px-4 py-3.5 transition-colors sm:gap-4 sm:px-5 ${
              mine ? "bg-accent-50" : "hover:bg-slate-50"
            }`}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-xs font-bold ${
                top
                  ? "bg-accent-100 text-accent-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {row.rank}
            </span>

            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${
                top ? "bg-accent-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
              aria-hidden
            >
              {initials(row.name)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink-900">
                <span className="truncate">{row.name}</span>
                {mine && (
                  <span className="shrink-0 rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-700">
                    {t("lb.you")}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-slate-400">@{shortId(row.clientId)}</p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-mono text-base font-bold text-ink-900">{row.correct}</p>
              <p className="text-xs text-slate-400">
                {row.tests} {t("lb.col.tests")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
