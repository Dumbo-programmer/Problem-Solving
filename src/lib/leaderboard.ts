import type { LeaderboardWindow, PeriodRow, PracticeTest, StandingsRow } from "./types";

/**
 * Leaderboard maths — shared by the SPA and the Netlify Function so the board
 * on screen always matches what the API serves.
 *
 * There are two boards:
 *   • per-test standings — shown on the contest (scheduled test) page, ranked
 *     by score on that paper; fastest time wins ties, then earliest finish;
 *   • overall leaderboard — "problems solved", ranked by how many problems a
 *     learner has solved correctly across every submitted scheduled test.
 *
 * Everything here is pure (no DOM, no Node APIs) so it runs identically in the
 * browser, in the function bundle and under vitest.
 */

/** Total seconds spent on a test (0 when unknown). */
export function timeTakenSec(test: Pick<PracticeTest, "startedAt" | "submittedAt">): number {
  if (!test.submittedAt) return 0;
  const ms = Date.parse(test.submittedAt) - Date.parse(test.startedAt);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
}

/** Score percentage of a submitted test (0–100, one decimal). */
export function pctOf(test: Pick<PracticeTest, "score" | "maxScore">): number {
  const max = test.maxScore || 1;
  return Math.round((test.score / max) * 1000) / 10;
}

/** A submitted entry that belongs on a leaderboard. */
export function isLeaderboardEntry(test: PracticeTest): boolean {
  return test.status === "SUBMITTED" && Boolean(test.scheduledTestId) && Boolean(test.submittedAt);
}

/** Public name for a row — display name, else a stable anonymous label. */
export function nameOf(test: Pick<PracticeTest, "displayName" | "clientId">): string {
  const name = (test.displayName ?? "").trim();
  if (name) return name;
  return `Learner ${shortId(test.clientId)}`;
}

/** Short, stable, non-identifying fragment of a client id. */
export function shortId(clientId: string): string {
  return clientId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) || "learner";
}

/** Rolling window start (null = no time restriction). */
export function windowStart(window: LeaderboardWindow, now = Date.now()): number | null {
  if (window === "week") return now - 7 * 24 * 60 * 60 * 1000;
  if (window === "month") return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

/** Format seconds as "12:34" or "1:02:03". */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Standings for a single test: score % desc, then faster submission, then
 * earlier submission (matches the reference app's contest tie-break).
 */
export function standings(entries: PracticeTest[], testId?: string): StandingsRow[] {
  const rows = entries
    .filter(isLeaderboardEntry)
    .filter((e) => (testId ? e.scheduledTestId === testId : true))
    .sort((a, b) => {
      const pctDiff = pctOf(b) - pctOf(a);
      if (pctDiff !== 0) return pctDiff;
      const timeDiff = timeTakenSec(a) - timeTakenSec(b);
      if (timeDiff !== 0) return timeDiff;
      return (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");
    });

  return rows.map((e, i) => ({
    rank: i + 1,
    entryId: e.id,
    name: nameOf(e),
    clientId: e.clientId,
    score: e.score,
    maxScore: e.maxScore,
    pct: pctOf(e),
    timeTakenSec: timeTakenSec(e),
    submittedAt: e.submittedAt ?? "",
    isYou: false,
  }));
}

/** Highlight rows belonging to this browser's anonymous id. */
export function markYou<T extends { clientId: string; isYou: boolean }>(rows: T[], clientId?: string): T[] {
  if (!clientId) return rows;
  return rows.map((r) => (r.clientId === clientId ? { ...r, isYou: true } : r));
}

interface Aggregate {
  name: string;
  solved: number;
  max: number;
  tests: number;
  time: number;
  best: number;
  pctSum: number;
}

/**
 * Overall board: problems solved across the rolling window, ranked by
 * solved desc → best test % desc → total time asc → name.
 *
 * "Solved" is the sum of correctCount over submitted scheduled tests, so the
 * board reads exactly as "how many problems has each learner solved".
 */
export function overallLeaderboard(
  entries: PracticeTest[],
  opts: { window?: LeaderboardWindow; clientId?: string; now?: number } = {}
): PeriodRow[] {
  const start = windowStart(opts.window ?? "all", opts.now ?? Date.now());
  const byPerson = new Map<string, Aggregate>();

  for (const e of entries) {
    if (!isLeaderboardEntry(e)) continue;
    const submitted = Date.parse(e.submittedAt ?? "");
    if (start !== null && submitted < start) continue;

    const agg = byPerson.get(e.clientId) ?? {
      name: nameOf(e),
      solved: 0,
      max: 0,
      tests: 0,
      time: 0,
      best: 0,
      pctSum: 0,
    };
    agg.solved += e.correctCount;
    agg.max += e.maxScore || e.problemIds.length;
    agg.tests += 1;
    agg.time += timeTakenSec(e);
    const pct = pctOf(e);
    agg.best = Math.max(agg.best, pct);
    agg.pctSum += pct;
    // Prefer the most recently used display name.
    if ((e.displayName ?? "").trim()) agg.name = nameOf(e);
    byPerson.set(e.clientId, agg);
  }

  const rows = [...byPerson.entries()].map(([clientId, agg]) => ({
    clientId,
    name: agg.name,
    tests: agg.tests,
    solved: agg.solved,
    avgPct: Math.round((agg.pctSum / Math.max(1, agg.tests)) * 10) / 10,
    bestPct: agg.best,
    time: agg.time,
    accuracy: agg.max ? Math.round((agg.solved / agg.max) * 100) : 0,
  }));

  rows.sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    if (b.bestPct !== a.bestPct) return b.bestPct - a.bestPct;
    if (a.time !== b.time) return a.time - b.time;
    return a.name.localeCompare(b.name);
  });

  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    clientId: r.clientId,
    tests: r.tests,
    correct: r.solved,
    points: r.solved,
    avgPct: r.avgPct,
    bestPct: r.bestPct,
    timeTakenSec: r.time,
    isYou: opts.clientId === r.clientId,
  }));
}

/** Find this browser's own row in an overall board (undefined = not ranked). */
export function findYou(rows: PeriodRow[], clientId?: string): PeriodRow | undefined {
  if (!clientId) return undefined;
  return rows.find((r) => r.isYou || r.clientId === clientId);
}
