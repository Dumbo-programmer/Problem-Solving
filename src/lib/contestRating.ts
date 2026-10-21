import type { ContestRatingRow, PracticeTest } from "./types";
import { isRankedEntry, nameOf, pctOf, timeTakenSec } from "./leaderboard";

/**
 * Contest rating — the Elo-style board that lives on the **contest** tab.
 *
 * This is deliberately a different metric from the leaderboard:
 *   • the leaderboard answers "how many problems has each learner solved?";
 *   • the contest rating answers "how did each learner do *against the field*
 *     in contests?" — a win is worth more than a pile of easy solves.
 *
 * The maths is pure (no DOM, no Node APIs) so the browser, the Netlify
 * Function and vitest all produce the same numbers.
 *
 * Rules
 *   • every learner starts on 1000 points;
 *   • each finished contest is a head-to-head round: better score % wins,
 *     the faster hand-in breaks a tie, and an identical result is a draw;
 *   • a win is worth 1, a draw 0.5, a loss 0; the expected score follows the
 *     usual Elo curve, so beating a much stronger learner is worth more;
 *   • the K-factor (24) sets how fast ratings move.
 */

/** Starting rating for every learner. */
export const START_RATING = 1000;

/** How fast a rating may move per contest. */
export const K_FACTOR = 24;

/** The smallest gap that still counts as a different result. */
const EPS = 1e-9;

/** The identity a rating belongs to. */
export function ratingKey(entry: Pick<PracticeTest, "accountId" | "clientId">): string {
  return entry.accountId?.trim() || `anon:${entry.clientId}`;
}

/** Expected score of A against B (0..1). */
function expected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** A contest as far as the rating maths cares about. */
export interface RatingPaper {
  id: string;
  startAt: string;
  endAt: string;
}

/**
 * The result of one contestant in one contest: score % and the hand-in time.
 */
interface Performance {
  key: string;
  clientId: string;
  accountId?: string;
  name: string;
  pct: number;
  time: number;
  submittedAt: string;
  solved: number;
}

/**
 * Order the contestants of one contest: score % desc, then the faster hand-in,
 * then the earlier submission — the same order the per-contest standings use.
 */
function orderContestants(entries: PracticeTest[]): Performance[] {
  return entries
    .filter(isRankedEntry)
    .map((e) => ({
      key: ratingKey(e),
      clientId: e.clientId,
      accountId: e.accountId,
      name: nameOf(e),
      pct: pctOf(e),
      time: timeTakenSec(e),
      submittedAt: e.submittedAt ?? "",
      solved: e.correctCount
    }))
    .sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (a.time !== b.time) return a.time - b.time;
      return a.submittedAt.localeCompare(b.submittedAt);
    });
}

/** Two contestants drew when both the score % and the hand-in time match. */
function isDraw(a: Performance, b: Performance): boolean {
  return Math.abs(a.pct - b.pct) < EPS && Math.abs(a.time - b.time) < EPS;
}

/**
 * The contest rating board.
 *
 * Only contests whose window has closed count, so the numbers stay stable
 * while a contest is still running. `now` is injectable for tests.
 */
export function contestRatings(
  entries: PracticeTest[],
  papers: RatingPaper[],
  opts: { now?: number; clientId?: string; accountId?: string } = {}
): ContestRatingRow[] {
  const now = opts.now ?? Date.now();

  interface Player {
    key: string;
    clientId: string;
    accountId?: string;
    name: string;
    rating: number;
    contests: number;
    wins: number;
    draws: number;
    bestRank: number;
    solved: number;
    lastDelta: number;
  }

  const players = new Map<string, Player>();
  const player = (p: Performance): Player => {
    const existing = players.get(p.key);
    if (existing) return existing;
    const fresh: Player = {
      key: p.key,
      clientId: p.clientId,
      accountId: p.accountId,
      name: p.name,
      rating: START_RATING,
      contests: 0,
      wins: 0,
      draws: 0,
      bestRank: Number.MAX_SAFE_INTEGER,
      solved: 0,
      lastDelta: 0
    };
    players.set(p.key, fresh);
    return fresh;
  };

  // Chronological order, so the rating is a history and not a snapshot.
  const finished = papers
    .filter((p) => {
      const end = Date.parse(p.endAt);
      return Number.isFinite(end) && end <= now;
    })
    .sort((a, b) => {
      const d = Date.parse(a.startAt) - Date.parse(b.startAt);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });

  for (const paper of finished) {
    const contestants = orderContestants(entries.filter((e) => e.scheduledTestId === paper.id));
    if (contestants.length === 0) continue;

    // A learner's best performance in a contest counts (one attempt per paper
    // is the rule on the runner, but a re-sit must not double-count).
    const best = new Map<string, Performance>();
    for (const c of contestants) {
      const held = best.get(c.key);
      if (!held || c.pct > held.pct || (c.pct === held.pct && c.time < held.time)) {
        best.set(c.key, c);
      }
    }
    const field = [...best.values()].sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (a.time !== b.time) return a.time - b.time;
      return a.submittedAt.localeCompare(b.submittedAt);
    });

    const before = new Map<string, number>();
    for (const p of field) before.set(p.key, player(p).rating);

    // Head-to-head: every pair plays once.
    const drewWith = new Set<string>();
    for (let i = 0; i < field.length; i++) {
      for (let j = i + 1; j < field.length; j++) {
        const a = field[i];
        const b = field[j];
        const ra = player(a);
        const rb = player(b);
        const draw = isDraw(a, b);
        const scoreA = draw ? 0.5 : 1;
        const scoreB = draw ? 0.5 : 0;
        const expA = expected(before.get(a.key)!, before.get(b.key)!);
        const expB = expected(before.get(b.key)!, before.get(a.key)!);
        ra.rating += K_FACTOR * (scoreA - expA);
        rb.rating += K_FACTOR * (scoreB - expB);
        if (draw) {
          drewWith.add(a.key);
          drewWith.add(b.key);
        }
      }
    }

    field.forEach((c, i) => {
      const p = player(c);
      p.contests += 1;
      p.solved += c.solved;
      p.bestRank = Math.min(p.bestRank, i + 1);
      // An outright win means finishing first on your own — a shared first
      // place is a draw, not a win.
      if (i === 0 && !drewWith.has(c.key)) p.wins += 1;
      if (drewWith.has(c.key)) p.draws += 1;
      p.lastDelta = p.rating - before.get(c.key)!;
    });
  }

  const rows: ContestRatingRow[] = [...players.values()].map((p) => ({
    rank: 0,
    name: p.name,
    key: p.key,
    clientId: p.clientId,
    accountId: p.accountId,
    rating: Math.max(0, Math.round(p.rating)),
    contests: p.contests,
    wins: p.wins,
    draws: p.draws,
    bestRank: p.bestRank === Number.MAX_SAFE_INTEGER ? 0 : p.bestRank,
    solved: p.solved,
    lastDelta: Math.round(p.lastDelta),
    isYou: p.key === opts.accountId || p.key === `anon:${opts.clientId}`
  }));

  rows.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.solved !== a.solved) return b.solved - a.solved;
    return a.name.localeCompare(b.name);
  });

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** A learner who has not been rated yet still reads as 1000 on the board. */
export function ratingOf(rows: ContestRatingRow[], accountId?: string, clientId?: string): ContestRatingRow | undefined {
  return rows.find(
    (r) => (accountId && r.accountId === accountId) || (!accountId && clientId && r.clientId === clientId)
  );
}
