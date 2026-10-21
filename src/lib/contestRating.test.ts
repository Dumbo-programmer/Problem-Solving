import { describe, expect, it } from "vitest";
import { contestRatings, ratingOf, K_FACTOR, START_RATING } from "./contestRating";
import { buildDemoEntries, buildScheduledSeeds } from "./scheduled";
import { PROBLEMS } from "../data";
import type { PracticeTest, ScheduledTest } from "./types";


/**
 * Contest rating maths â€” the board that lives on the contest tab.
 *
 * The rules under test: everybody starts on 1000, a win is worth more than a
 * draw, beating a stronger learner is worth more than beating a weaker one,
 * only finished contests count, and a re-sit cannot double-count.
 */

const T0 = "2026-01-01T00:00:00.000Z";

function entry(over: Partial<PracticeTest> & { clientId: string; scheduledTestId: string }): PracticeTest {
  const { clientId, scheduledTestId, correctCount, submittedAt, ...rest } = over;
  return {
    id: `e-${clientId}-${scheduledTestId}`,
    clientId,
    title: "Contest",
    filters: { types: [], topics: [], categories: [], difficulties: [] },
    problemIds: ["p1", "p2"],
    durationMin: 30,
    status: "SUBMITTED",
    answers: [],
    score: correctCount ?? 1,
    maxScore: 2,
    correctCount: correctCount ?? 1,
    startedAt: T0,
    submittedAt: submittedAt ?? T0,
    origin: "cloud",
    scheduledTestId,
    ...rest
  } as PracticeTest;
}


function paper(over: Partial<ScheduledTest> & { id: string }): ScheduledTest {
  return {
    kind: "CONTEST",
    title: { bn: "à¦ªà§à¦°à¦¤à¦¿à¦¯à§‹à¦—à¦¿à¦¤à¦¾", en: "Contest" },
    description: { bn: "", en: "" },
    startAt: "2026-01-01T00:00:00.000Z",
    endAt: "2026-01-02T00:00:00.000Z",
    durationMin: 60,
    problemIds: ["p1", "p2"],
    published: true,
    ...over
  } as ScheduledTest;
}

const NOW = Date.parse("2026-02-01T00:00:00.000Z");

describe("contestRatings", () => {
  it("moves the rating by half the K-factor for an even match", () => {
    const rows = contestRatings(
      [
        entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c1", correctCount: 2 }),
        entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "c1", correctCount: 1 })
      ],
      [paper({ id: "c1" })],
      { now: NOW }
    );
    expect(rows).toHaveLength(2);
    // Two equal learners: the winner takes half the K-factor, the loser gives it.
    expect(rows[0].rating).toBe(START_RATING + K_FACTOR / 2);
    expect(rows[1].rating).toBe(START_RATING - K_FACTOR / 2);
  });

  it("rewards a winner and punishes the loser", () => {
    const rows = contestRatings(
      [
        entry({
          clientId: "a",
          accountId: "acc-a",
          scheduledTestId: "c1",
          correctCount: 2,
          submittedAt: "2026-01-01T10:00:00.000Z"
        }),
        entry({
          clientId: "b",
          accountId: "acc-b",
          scheduledTestId: "c1",
          correctCount: 1,
          submittedAt: "2026-01-01T11:00:00.000Z"
        })
      ],
      [paper({ id: "c1" })],
      { now: NOW }
    );
    const a = rows.find((r) => r.accountId === "acc-a")!;
    const b = rows.find((r) => r.accountId === "acc-b")!;
    expect(a.rating).toBeGreaterThan(START_RATING);
    expect(b.rating).toBeLessThan(START_RATING);
    expect(a.wins).toBe(1);
    expect(b.wins).toBe(0);
    expect(a.rank).toBe(1);
  });

  it("counts a draw as half a point", () => {
    const same = { correctCount: 2, submittedAt: "2026-01-01T10:00:00.000Z" };
    const rows = contestRatings(
      [
        entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c1", ...same }),
        entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "c1", ...same })
      ],
      [paper({ id: "c1" })],
      { now: NOW }
    );
    expect(rows.every((r) => r.rating === START_RATING)).toBe(true);
    expect(rows.every((r) => r.draws === 1)).toBe(true);
  });

  it("ignores contests that have not finished yet", () => {
    const rows = contestRatings(
      [
        entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "live", correctCount: 2 }),
        entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "live", correctCount: 1 })
      ],
      [paper({ id: "live", endAt: "2026-03-01T00:00:00.000Z" })],
      { now: NOW }
    );
    expect(rows).toHaveLength(0);
  });

  it("gives more for beating a stronger learner", () => {
    // A beats B in every contest. The first win is worth the most: as B's
    // rating drops, A's expected score rises, so later wins pay less.
    const papers = [
      paper({ id: "c1", startAt: "2026-01-01T00:00:00.000Z", endAt: "2026-01-02T00:00:00.000Z" }),
      paper({ id: "c2", startAt: "2026-01-03T00:00:00.000Z", endAt: "2026-01-04T00:00:00.000Z" }),
      paper({ id: "c3", startAt: "2026-01-05T00:00:00.000Z", endAt: "2026-01-06T00:00:00.000Z" })
    ];
    const entries = [
      entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c1", correctCount: 2 }),
      entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "c1", correctCount: 1 }),
      entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c2", correctCount: 2 }),
      entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "c2", correctCount: 1 }),
      entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c3", correctCount: 2 }),
      entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "c3", correctCount: 1 })
    ];

    const afterFirst = contestRatings(entries.slice(0, 2), [papers[0]], { now: NOW });
    const afterThree = contestRatings(entries, papers, { now: NOW });
    const firstGain = afterFirst.find((r) => r.accountId === "acc-a")!.lastDelta;
    const lastGain = afterThree.find((r) => r.accountId === "acc-a")!.lastDelta;

    expect(firstGain).toBeGreaterThan(0);
    expect(lastGain).toBeGreaterThan(0);
    // The gap widens, so the expected score rises and the win pays less.
    expect(lastGain).toBeLessThan(firstGain);

    const a = afterThree.find((r) => r.accountId === "acc-a")!;
    const b = afterThree.find((r) => r.accountId === "acc-b")!;
    expect(a.rating).toBeGreaterThan(START_RATING);
    expect(b.rating).toBeLessThan(START_RATING);
    expect(a.wins).toBe(3);
    expect(a.contests).toBe(3);
  });

  it("does not double-count a re-sit in the same contest", () => {
    const rows = contestRatings(
      [
        entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c1", correctCount: 2 }),
        entry({
          clientId: "a",
          accountId: "acc-a",
          scheduledTestId: "c1",
          correctCount: 0,
          id: "e-a-2"
        }),
        entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "c1", correctCount: 1 })
      ],
      [paper({ id: "c1" })],
      { now: NOW }
    );
    const a = rows.find((r) => r.accountId === "acc-a")!;
    expect(a.contests).toBe(1);
    expect(a.solved).toBe(2); // the best attempt counts, not the sum
    expect(a.rating).toBeGreaterThan(START_RATING);
  });

  it("marks the signed-in learner's own row", () => {
    const rows = contestRatings(
      [
        entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c1", correctCount: 2 }),
        entry({ clientId: "b", accountId: "acc-b", scheduledTestId: "c1", correctCount: 1 })
      ],
      [paper({ id: "c1" })],
      { now: NOW, accountId: "acc-b" }
    );
    expect(ratingOf(rows, "acc-b")?.isYou).toBe(true);
    expect(ratingOf(rows, "acc-a")?.isYou).toBe(false);
  });

  it("never lets a rating go negative", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      entry({
        clientId: `b${i}`,
        accountId: `acc-b${i}`,
        scheduledTestId: "c1",
        correctCount: 0
      })
    );
    const rows = contestRatings(
      [entry({ clientId: "a", accountId: "acc-a", scheduledTestId: "c1", correctCount: 2 }), ...many],
      [paper({ id: "c1" })],
      { now: NOW }
    );
    expect(rows.every((r) => r.rating >= 0)).toBe(true);
  });

  it("rates the seeded demo field, so the offline board is never blank", () => {
    // The browser fallback seeds weekly/monthly papers and a demo field; the
    // rating board has to work off exactly that data.
    const seeds = buildScheduledSeeds(PROBLEMS, new Date("2026-02-01T00:00:00.000Z"));
    const entries = buildDemoEntries(seeds, Date.parse("2026-02-01T00:00:00.000Z"));
    const rows = contestRatings(entries, seeds, { now: Date.parse("2026-02-01T00:00:00.000Z") });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.rating >= 0 && r.contests > 0)).toBe(true);
    expect(rows[0].rank).toBe(1);
  });
});


