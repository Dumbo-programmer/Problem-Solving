import { describe, expect, it } from "vitest";
import {
  formatDuration,
  isLeaderboardEntry,
  markYou,
  nameOf,
  overallLeaderboard,
  pctOf,
  shortId,
  standings,
  timeTakenSec,
  windowStart
} from "./leaderboard";
import type { PracticeTest } from "./types";

const EMPTY_FILTERS = { types: [], topics: [], categories: [], difficulties: [] };

function entry(over: Partial<PracticeTest> = {}): PracticeTest {
  return {
    id: over.id ?? "e-1",
    clientId: over.clientId ?? "client-a",
    title: "Weekly Sprint",
    filters: { ...EMPTY_FILTERS },
    problemIds: ["p1", "p2", "p3"],
    durationMin: 45,
    status: "SUBMITTED",
    answers: [],
    score: 2,
    maxScore: 3,
    correctCount: 2,
    startedAt: "2026-10-19T10:00:00.000Z",
    submittedAt: "2026-10-19T10:20:00.000Z",
    origin: "local",
    scheduledTestId: "wk-2026-42",
    displayName: "Rafiq R.",
    ...over
  };
}

describe("per-test standings", () => {
  it("ranks by score percentage, descending", () => {
    const rows = standings([
      entry({ id: "a", score: 1, correctCount: 1 }),
      entry({ id: "b", score: 3, correctCount: 3 }),
      entry({ id: "c", score: 2, correctCount: 2 })
    ]);
    expect(rows.map((r) => r.entryId)).toEqual(["b", "c", "a"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows[0].pct).toBe(100);
  });

  it("breaks score ties on time taken, then submission time", () => {
    const rows = standings([
      entry({ id: "slow", submittedAt: "2026-10-19T10:40:00.000Z" }), // 40 min
      entry({ id: "fast", submittedAt: "2026-10-19T10:10:00.000Z" }), // 10 min
      entry({ id: "same", submittedAt: "2026-10-19T10:15:00.000Z" }) // 15 min
    ]);
    expect(rows.map((r) => r.entryId)).toEqual(["fast", "same", "slow"]);
  });

  it("only includes submitted entries of the requested paper", () => {
    const rows = standings(
      [
        entry({ id: "right" }),
        entry({ id: "other-paper", scheduledTestId: "mo-2026-10" }),
        entry({ id: "in-progress", status: "IN_PROGRESS", submittedAt: undefined }),
        entry({ id: "practice", scheduledTestId: undefined })
      ],
      "wk-2026-42"
    );
    expect(rows.map((r) => r.entryId)).toEqual(["right"]);
    expect(isLeaderboardEntry(entry({ scheduledTestId: undefined }))).toBe(false);
  });

  it("highlights this browser's row via markYou", () => {
    const rows = standings([entry({ id: "mine", clientId: "client-x" })]);
    expect(rows[0].isYou).toBe(false);
    expect(markYou(rows, "client-x")[0].isYou).toBe(true);
    expect(markYou(rows, "someone-else")[0].isYou).toBe(false);
  });
});

describe("overall leaderboard", () => {
  it("sums problems solved per learner and ranks by solved", () => {
    const rows = overallLeaderboard(
      [
        entry({ id: "a1", clientId: "alpha", displayName: "Alpha", correctCount: 3, score: 3 }),
        entry({ id: "a2", clientId: "alpha", displayName: "Alpha", correctCount: 2, score: 2 }),
        entry({ id: "b1", clientId: "beta", displayName: "Beta", correctCount: 4, score: 4 })
      ],
      { window: "all" }
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].clientId).toBe("alpha");
    expect(rows[0].correct).toBe(5); // 3 + 2 across two papers
    expect(rows[0].tests).toBe(2);
    expect(rows[1].clientId).toBe("beta");
    expect(rows[1].correct).toBe(4);
  });

  it("respects the rolling window", () => {
    const now = Date.parse("2026-10-19T12:00:00.000Z");
    const fresh = entry({ id: "new", clientId: "fresh-client", submittedAt: "2026-10-18T10:00:00.000Z" });
    const old = entry({ id: "old", clientId: "old-client", submittedAt: "2026-09-01T10:00:00.000Z" });

    const week = overallLeaderboard([fresh, old], { window: "week", now });
    expect(week).toHaveLength(1);
    expect(week[0].clientId).toBe("fresh-client");

    const month = overallLeaderboard([fresh, old], { window: "month", now });
    expect(month).toHaveLength(1); // "old" is 48 days back, outside the 30-day window
    expect(month[0].clientId).toBe("fresh-client");

    expect(overallLeaderboard([fresh, old], { window: "all", now })).toHaveLength(2);
  });

  it("marks this browser's row", () => {
    const rows = overallLeaderboard([entry({ clientId: "mine" })], { clientId: "mine" });
    expect(rows[0].isYou).toBe(true);
  });

  it("windowStart rolls back 7 / 30 days and is null for all-time", () => {
    const now = Date.parse("2026-10-19T00:00:00.000Z");
    expect(windowStart("week", now)).toBe(now - 7 * 86_400_000);
    expect(windowStart("month", now)).toBe(now - 30 * 86_400_000);
    expect(windowStart("all", now)).toBeNull();
  });
});

describe("helpers", () => {
  it("measures time taken and score percentage", () => {
    expect(timeTakenSec({ startedAt: "2026-10-19T10:00:00Z", submittedAt: "2026-10-19T10:02:30Z" })).toBe(150);
    expect(timeTakenSec({ startedAt: "2026-10-19T10:00:00Z", submittedAt: undefined })).toBe(0);
    expect(pctOf({ score: 2, maxScore: 3 })).toBeCloseTo(66.7, 1);
    expect(pctOf({ score: 0, maxScore: 0 })).toBe(0);
  });

  it("formats durations as m:ss / h:mm:ss", () => {
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(0)).toBe("0:00");
  });

  it("names rows from the display name, else a stable short id", () => {
    expect(nameOf({ displayName: "  Tasnim  ", clientId: "abc-123-def" })).toBe("Tasnim");
    expect(nameOf({ displayName: "", clientId: "abc-123-def" })).toBe("Learner abc123");
    expect(shortId("!!xyz!!")).toBe("xyz");
  });
});
