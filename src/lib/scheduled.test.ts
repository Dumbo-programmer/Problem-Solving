import { describe, expect, it } from "vitest";
import {
  bnNum,
  buildDemoEntries,
  buildScheduledSeeds,
  countdownParts,
  entryDeadline,
  phaseOf,
  seedIds,
  weekStart,
  monthStart,
  DEMO_PEOPLE
} from "./scheduled";
import type { PracticeTest, ScheduledTest } from "./types";

/** A small stand-in bank: 4 topics × 3 difficulties × 2 problems = 24. */
const BANK = (() => {
  const topics = ["NUMBER_THEORY", "ALGEBRA", "GEOMETRY", "COMBINATORICS"];
  const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
  const out: { id: string; difficulty: string; topic: string }[] = [];
  let n = 0;
  for (const topic of topics) {
    for (const difficulty of difficulties) {
      for (let i = 0; i < 2; i++) {
        n += 1;
        out.push({ id: `p-${n}`, difficulty, topic });
      }
    }
  }
  return out;
})();

// A fixed "now" (a Monday) so windows are deterministic.
const NOW = new Date("2026-10-19T08:00:00.000Z"); // Monday

describe("phase windows", () => {
  it("goes upcoming → live → ended across the boundaries", () => {
    const test = { startAt: "2026-10-19T00:00:00.000Z", endAt: "2026-10-26T00:00:00.000Z" };
    expect(phaseOf(test, Date.parse("2026-10-18T23:59:59Z"))).toBe("upcoming");
    expect(phaseOf(test, Date.parse("2026-10-19T00:00:00Z"))).toBe("live");
    expect(phaseOf(test, Date.parse("2026-10-25T23:59:59Z"))).toBe("live");
    expect(phaseOf(test, Date.parse("2026-10-26T00:00:00Z"))).toBe("ended");
  });

  it("clamps a personal attempt to the paper's window end", () => {
    const test = { endAt: "2026-10-19T12:00:00.000Z", durationMin: 60 };
    // Started with plenty of window left → personal duration wins.
    expect(entryDeadline(test, "2026-10-19T09:00:00.000Z")).toBe(Date.parse("2026-10-19T10:00:00Z"));
    // Started 10 minutes before the window shuts → window end wins.
    expect(entryDeadline(test, "2026-10-19T11:50:00.000Z")).toBe(Date.parse("2026-10-19T12:00:00Z"));
  });

  it("weekStart lands on a Monday and monthStart on the 1st", () => {
    const fromWednesday = weekStart(new Date("2026-10-21T15:30:00")); // any day mid-week
    expect(fromWednesday.getDay()).toBe(1);
    expect(fromWednesday.getDate()).toBe(19); // Monday of that week
    const fromNow = weekStart(new Date(NOW));
    expect(fromNow.getDay()).toBe(1);
    expect(weekStart(new Date(NOW), -1).getTime()).toBe(fromNow.getTime() - 7 * 86_400_000);
    const month = monthStart(new Date(NOW));
    expect(month.getDate()).toBe(1);
    expect(month.getMonth()).toBe(9);
    expect(monthStart(new Date(NOW), 1).getMonth()).toBe(10);
  });

  it("counts down in d/h/m/s with a clamped floor of zero", () => {
    const parts = countdownParts(2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000);
    expect(parts).toMatchObject({ d: 2, h: 3, m: 4, s: 5 });
    expect(countdownParts(-5000).totalMs).toBe(0);
  });
});

describe("seed papers", () => {
  const seeds = buildScheduledSeeds(BANK, new Date(NOW));

  it("seeds last week (ended), this week (live), next week, this month and next month", () => {
    expect(seeds).toHaveLength(5);
    expect(seeds.map((t) => t.kind)).toEqual(["WEEKLY", "WEEKLY", "WEEKLY", "MONTHLY", "MONTHLY"]);

    expect(phaseOf(seeds[0], NOW.getTime())).toBe("ended");
    expect(phaseOf(seeds[1], NOW.getTime())).toBe("live");
    expect(phaseOf(seeds[2], NOW.getTime())).toBe("upcoming");
    expect(phaseOf(seeds[3], NOW.getTime())).toBe("live");
    expect(phaseOf(seeds[4], NOW.getTime())).toBe("upcoming");
  });

  it("derives calendar ids so server and browser agree without syncing", () => {
    const ids = seedIds(BANK, NOW.getTime());
    expect(ids[1]).toMatch(/^wk-\d{4}-\d{2}$/);
    expect(ids[3]).toMatch(/^mo-\d{4}-\d{2}$/);
    expect(new Set(ids).size).toBe(ids.length);
    // Rebuilding at the same instant reproduces the same identities.
    expect(buildScheduledSeeds(BANK, new Date(NOW)).map((t) => t.id)).toEqual(ids);
  });

  it("builds balanced bilingual papers (8 weekly / 12 monthly)", () => {
    for (const t of seeds) {
      expect(t.title.bn.trim()).not.toBe("");
      expect(t.title.en.trim()).not.toBe("");
      expect(t.description.bn.trim()).not.toBe("");
      expect(t.published).toBe(true);
      expect(new Set(t.problemIds).size).toBe(t.problemIds.length); // no repeats
      for (const id of t.problemIds) expect(BANK.some((p) => p.id === id)).toBe(true);
    }
    const weekly = seeds.filter((t) => t.kind === "WEEKLY");
    const monthly = seeds.filter((t) => t.kind === "MONTHLY");
    expect(weekly.every((t) => t.problemIds.length === 8)).toBe(true);
    expect(monthly.every((t) => t.problemIds.length === 12)).toBe(true);
    // Weekly papers stay approachable: no OLYMPIAD entries in the weekly pool.
    const weeklyPool = new Set(seeds.filter((t) => t.kind === "WEEKLY").flatMap((t) => t.problemIds));
    expect([...weeklyPool].some((id) => BANK.find((p) => p.id === id)?.difficulty === "OLYMPIAD")).toBe(false);
    // Consecutive weeks reuse no problem (different shift per seed).
    expect(weekly[0].problemIds.filter((id) => weekly[1].problemIds.includes(id))).toHaveLength(0);
  });

  it("keeps windows of exactly one week / one calendar month", () => {
    const week = seeds[1];
    expect(Date.parse(week.endAt) - Date.parse(week.startAt)).toBe(7 * 86_400_000);
    const month = seeds[3];
    const start = new Date(month.startAt);
    const end = new Date(month.endAt);
    expect(end.getMonth() === start.getMonth() + 1 || start.getMonth() === 11).toBe(true);
    expect(end.getDate()).toBe(1);
  });
});

describe("demo leaderboard entries", () => {
  const seeds = buildScheduledSeeds(BANK, new Date(NOW));
  const entries = buildDemoEntries(seeds, NOW.getTime());

  it("is deterministic — server and browser build identical boards", () => {
    expect(buildDemoEntries(seeds, NOW.getTime())).toEqual(entries);
    // Different paper id → different mix, but still stable.
    const other = buildDemoEntries(
      seeds.map((t) => ({ ...t, id: `${t.id}-x` })),
      NOW.getTime()
    );
    expect(other.map((e) => e.id)).toEqual(buildDemoEntries(
      seeds.map((t) => ({ ...t, id: `${t.id}-x` })),
      NOW.getTime()
    ).map((e) => e.id));
  });

  it("only fills papers that have begun, with sane scores and times", () => {
    for (const e of entries) {
      const test = seeds.find((t) => t.id === e.scheduledTestId);
      expect(test).toBeDefined();
      expect(Date.parse(test!.startAt)).toBeLessThanOrEqual(Date.parse(e.startedAt!));
      expect(Date.parse(e.submittedAt!)).toBeGreaterThanOrEqual(Date.parse(e.startedAt!));
      expect(e.status).toBe("SUBMITTED");
      expect(e.correctCount).toBeLessThanOrEqual(e.problemIds.length);
      expect(e.correctCount).toBeGreaterThan(0);
      expect(e.displayName!.trim()).not.toBe("");
      expect(DEMO_PEOPLE.some((p) => p.clientId === e.clientId)).toBe(true);
    }
    // The next week's paper hasn't started → nobody sat it.
    expect(entries.some((e) => e.scheduledTestId === seeds[2].id)).toBe(false);
    // Enough variety for a lively board.
    expect(entries.length).toBeGreaterThanOrEqual(6);
    expect(new Set(entries.map((e) => e.clientId)).size).toBeGreaterThanOrEqual(4);
  });

  it("leaves a meaningful spread of scores (not everyone perfect)", () => {
    const scores = entries.map((e) => e.correctCount / e.problemIds.length);
    expect(Math.min(...scores)).toBeLessThan(1);
    expect(Math.max(...scores)).toBe(1);
  });
});

describe("misc", () => {
  it("renders Bangla numerals", () => {
    expect(bnNum(42)).toBe("৪২");
    expect(bnNum("2026")).toBe("২০২৬");
  });

  it("builds seeds that are plain data (serialisable)", () => {
    const seeds = buildScheduledSeeds(BANK, new Date(NOW)) as ScheduledTest[];
    expect(() => JSON.parse(JSON.stringify(seeds))).not.toThrow();
    const entries = buildDemoEntries(seeds, NOW.getTime()) as PracticeTest[];
    expect(() => JSON.parse(JSON.stringify(entries))).not.toThrow();
  });
});
