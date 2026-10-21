import type { Localized, PracticeTest, ScheduledTest, TestFilters, TestPhase } from "./types";

/**
 * Weekly / monthly ("scheduled") test mechanics — pure and shared:
 * the SPA uses it as the offline fallback seed, the Netlify Function uses it
 * to seed Postgres, and vitest unit-tests it directly.
 *
 * Seed ids are derived from the calendar (wk-2026-42, mo-2026-10) so each new
 * week/month rolls in as a fresh paper while past papers stay readable, and so
 * the browser fallback and the database agree on identity without syncing.
 */

export interface SeedProblem {
  id: string;
  difficulty: string;
  topic: string;
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

/** Bangla numeral rendering (dates, counts). */
export function bnNum(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday 00:00 of the week containing `d` (local time), optionally offset. */
export function weekStart(d: Date, offsetWeeks = 0): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const back = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - back + offsetWeeks * 7);
  return x;
}

/** First day of the month containing `d`, optionally offset (local time). */
export function monthStart(d: Date, offsetMonths = 0): Date {
  const x = startOfDay(d);
  x.setDate(1);
  x.setMonth(x.getMonth() + offsetMonths);
  return x;
}

/** ISO-8601 week number + week-year for a date. */
function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // Thursday of this week
  const year = t.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const fDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDay + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { year, week };
}

/* ------------------------------------------------------------------ */
/* Phases                                                              */
/* ------------------------------------------------------------------ */

/** upcoming → live → ended, evaluated against `now` (ms). */
export function phaseOf(test: Pick<ScheduledTest, "startAt" | "endAt">, now = Date.now()): TestPhase {
  const start = Date.parse(test.startAt);
  const end = Date.parse(test.endAt);
  if (Number.isFinite(start) && now < start) return "upcoming";
  if (Number.isFinite(end) && now >= end) return "ended";
  return "live";
}

/** When a personal attempt that started at `startedAt` must be handed in. */
export function entryDeadline(test: Pick<ScheduledTest, "endAt" | "durationMin">, startedAt: string): number {
  const windowEnd = Date.parse(test.endAt);
  const personalEnd = Date.parse(startedAt) + test.durationMin * 60_000;
  if (!Number.isFinite(windowEnd)) return personalEnd;
  return Math.min(windowEnd, personalEnd);
}

/** Break a millisecond span into d/h/m/s for a countdown. */
export function countdownParts(ms: number): { d: number; h: number; m: number; s: number; totalMs: number } {
  const clamped = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(clamped / 1000);
  return {
    d: Math.floor(totalSec / 86_400),
    h: Math.floor((totalSec % 86_400) / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    totalMs: clamped,
  };
}

/* ------------------------------------------------------------------ */
/* Seed papers                                                         */
/* ------------------------------------------------------------------ */

function startEndIso(start: Date, durationDays: number): { startAt: string; endAt: string } {
  const end = new Date(start);
  end.setDate(end.getDate() + durationDays);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

/**
 * Round-robin across topics so a seed paper is balanced. `shift` changes which
 * problem each topic contributes, so consecutive weeks draw from a different
 * slice; `used` records what earlier seeds already claimed so papers stay fresh
 * (falling back to the full pool only when the bank runs dry).
 */
function spread(pool: SeedProblem[], n: number, shift = 0, used?: Set<string>): string[] {
  const available = used ? pool.filter((p) => !used.has(p.id)) : pool;
  const out = roundRobin(available, n, shift);
  if (out.length < n) {
    // Starved (small bank / heavy exclusion): top up from the full pool in order.
    for (const p of pool) {
      if (out.length >= n) break;
      if (!out.includes(p.id)) out.push(p.id);
    }
  }
  if (used) for (const id of out) used.add(id);
  return out;
}

/** Draw `n` ids, one per topic per pass, starting at `shift` in each queue. */
function roundRobin(pool: SeedProblem[], n: number, shift: number): string[] {
  const byTopic = new Map<string, string[]>();
  for (const p of pool) {
    const queue = byTopic.get(p.topic) ?? [];
    queue.push(p.id);
    byTopic.set(p.topic, queue);
  }
  const queues = [...byTopic.values()].filter((q) => q.length > 0);
  if (queues.length === 0) return [];

  const out: string[] = [];
  const cursors = queues.map((q) => shift % q.length);
  let guard = 0;
  while (out.length < n && guard < n + queues.length + 2) {
    for (let qi = 0; qi < queues.length && out.length < n; qi++) {
      const q = queues[qi];
      if (cursors[qi] < q.length) {
        out.push(q[cursors[qi]]);
        cursors[qi] += 1;
      }
    }
    guard += 1;
  }
  return out;
}

function weeklyWindowTitle(start: Date, end: Date): Localized {
  const fromDay = start.getDate();
  const toDay = end.getDate() - 1;
  const m = end.getMonth();
  const y = end.getFullYear();
  const sameMonth = start.getMonth() === m;
  const range = sameMonth
    ? `${fromDay}–${toDay} ${EN_MONTHS[m]}`
    : `${fromDay} ${EN_MONTHS[start.getMonth()]} – ${toDay} ${EN_MONTHS[m]}`;
  const bnRange = sameMonth
    ? `${bnNum(fromDay)}–${bnNum(toDay)} ${BN_MONTHS[m]}`
    : `${bnNum(fromDay)} ${BN_MONTHS[start.getMonth()]} – ${bnNum(toDay)} ${BN_MONTHS[m]}`;
  void y;
  return {
    bn: `সাপ্তাহিক স্প্রিন্ট · ${bnRange}`,
    en: `Weekly Sprint · ${range}`,
  };
}

function monthlyWindowTitle(start: Date): Localized {
  const m = start.getMonth();
  const y = start.getFullYear();
  return {
    bn: `মাসিক চ্যালেঞ্জ · ${BN_MONTHS[m]} ${bnNum(y)}`,
    en: `Monthly Challenge · ${EN_MONTHS_LONG[m]} ${y}`,
  };
}

const WEEKLY_DESC: Localized = {
  bn: "আটটি সমস্যা, ৪৫ মিনিট। প্রতি সপ্তাহে নতুন একটি পত্র।",
  en: "Eight problems, 45 minutes — a fresh paper every week.",
};
const MONTHLY_DESC: Localized = {
  bn: "বারোটি সমস্যা, ৯০ মিনিট — মাসের বড় চ্যালেঞ্জ।",
  en: "Twelve problems, 90 minutes — the big monthly challenge.",
};

/**
 * The bundled seed papers: last week (ended), this week (live), next week
 * (upcoming), this month (live) and next month (upcoming). Passing a different
 * `now` moves every window with it, which is exactly what the server does on
 * cold start and what the browser does when the API is unreachable.
 */
export function buildScheduledSeeds(
  bank: SeedProblem[],
  now = new Date(),
  opts: { exclude?: Iterable<string> } = {}
): ScheduledTest[] {
  // Weekly papers stay approachable (no OLYMPIAD); monthly pulls the full bank.
  const weeklyPool = bank.filter((p) => p.difficulty !== "OLYMPIAD");
  const monthlyPool = bank;
  // Problems already claimed (by earlier seeds in this pass, and — when the
  // caller passes them — by papers sitting in the database from past weeks).
  const used = new Set<string>(opts.exclude ?? []);

  const mkWeek = (offsetWeeks: number, shift: number, published: boolean): ScheduledTest => {
    const start = weekStart(now, offsetWeeks);
    const { startAt, endAt } = startEndIso(start, 7);
    const { year, week } = isoWeek(start);
    const paperStart = new Date(start);
    const paperEnd = new Date(start);
    paperEnd.setDate(paperEnd.getDate() + 7);
    return {
      id: `wk-${year}-${String(week).padStart(2, "0")}`,
      kind: "WEEKLY",
      title: weeklyWindowTitle(paperStart, paperEnd),
      description: WEEKLY_DESC,
      startAt,
      endAt,
      durationMin: 45,
      problemIds: spread(weeklyPool.length ? weeklyPool : monthlyPool, 8, shift, used),
      published,
    };
  };

  const mkMonth = (offsetMonths: number, shift: number, published: boolean): ScheduledTest => {
    const start = monthStart(now, offsetMonths);
    const next = monthStart(now, offsetMonths + 1);
    const { startAt, endAt } = startEndIso(start, Math.round((next.getTime() - start.getTime()) / 86_400_000));
    return {
      id: `mo-${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      kind: "MONTHLY",
      title: monthlyWindowTitle(start),
      description: MONTHLY_DESC,
      startAt,
      endAt,
      durationMin: 90,
      problemIds: spread(monthlyPool, 12, shift, used),
      published,
    };
  };

  return [
    mkWeek(-1, 1, true), // last week — ended, standings already in
    mkWeek(0, 0, true), // this week — live
    mkWeek(1, 2, true), // next week — upcoming
    mkMonth(0, 3, true), // this month — live
    mkMonth(1, 6, true), // next month — upcoming
  ];
}

/** The seeded ids for the current clock — used to upsert without duplicating. */
export function seedIds(bank: SeedProblem[], now = Date.now()): string[] {
  return buildScheduledSeeds(bank, new Date(now)).map((t) => t.id);
}

/* ------------------------------------------------------------------ */
/* What kind of attempt is this?                                        */
/* ------------------------------------------------------------------ */

/**
 * How a stored attempt relates to the scheduled programme.
 *
 *   • `practice`  — the learner built the paper themselves (no scheduled id)
 *   • `weekly`    — an attempt at the weekly sprint
 *   • `monthly`   — an attempt at the monthly challenge
 *   • `scheduled` — an attempt at some other published paper
 */
export type AttemptKind = "practice" | "weekly" | "monthly" | "scheduled";

/**
 * Classifies a past attempt.
 *
 * The scheduled-paper list is the source of truth; when a paper is missing
 * from it (an old week, or a database that has moved on) the id scheme still
 * gives the answer, because every seeded paper is `wk-YYYY-WW` or `mo-YYYY-MM`.
 */
export function attemptKind(
  attempt: { scheduledTestId?: string },
  papers: Pick<ScheduledTest, "id" | "kind">[] = []
): AttemptKind {
  const id = attempt.scheduledTestId;
  if (!id) return "practice";

  const paper = papers.find((p) => p.id === id);
  if (paper) {
    if (paper.kind === "WEEKLY") return "weekly";
    if (paper.kind === "MONTHLY") return "monthly";
    return "scheduled";
  }

  if (id.startsWith("wk-")) return "weekly";
  if (id.startsWith("mo-")) return "monthly";
  return "scheduled";
}

/* ------------------------------------------------------------------ */
/* Demo (dummy) leaderboard entries                                    */
/* ------------------------------------------------------------------ */

/** Sample learners so both boards look alive before real traffic arrives. */
export const DEMO_PEOPLE: { clientId: string; name: string }[] = [
  { clientId: "demo-01", name: "তাসনিম জাহান" },
  { clientId: "demo-02", name: "মাহিন আহমেদ" },
  { clientId: "demo-03", name: "সাদিয়া ইসলাম" },
  { clientId: "demo-04", name: "তানভীর রহমান" },
  { clientId: "demo-05", name: "নুসরাত জাহান" },
  { clientId: "demo-06", name: "আরিফ চৌধুরী" },
  { clientId: "demo-07", name: "ফারহানা আক্তার" },
  { clientId: "demo-08", name: "ইমরান কবির" },
  { clientId: "demo-09", name: "সাবিনা ইয়াসমিন" },
  { clientId: "demo-10", name: "জাহিদ হাসান" },
  { clientId: "demo-11", name: "মেহজাবিন চৌধুরী" },
  { clientId: "demo-12", name: "শুভ সাহা" },
  { clientId: "demo-13", name: "রুমানা বেগম" },
  { clientId: "demo-14", name: "আদিত্য দাস" },
  { clientId: "demo-15", name: "Nafis Ibrahim" },
  { clientId: "demo-16", name: "Raihan Kabir" },
];

/** Deterministic PRNG so the demo board is identical on server and client. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const EMPTY_FILTERS: TestFilters = {
  types: [],
  topics: [],
  categories: [],
  difficulties: [],
};

/**
 * Deterministic demo submissions for every seed paper that has already begun:
 * ~70% of the sample learners sit each paper with varied scores and times.
 * Both the database seed and the browser fallback run this, so the boards
 * match whichever source is serving.
 */
export function buildDemoEntries(tests: ScheduledTest[], now = Date.now()): PracticeTest[] {
  const entries: PracticeTest[] = [];

  for (const test of tests) {
    if (Date.parse(test.startAt) > now) continue; // nobody sits an unpublished window
    const n = test.problemIds.length;
    if (n === 0) continue;
    const windowStartMs = Date.parse(test.startAt);
    const windowEndMs = Date.parse(test.endAt);
    const durationMs = test.durationMin * 60_000;

    DEMO_PEOPLE.forEach((person, pi) => {
      const rnd = mulberry32(hashString(test.id) + pi * 7919);
      if (rnd() > 0.72) return; // skipped this paper

      const correct = Math.max(1, Math.min(n, Math.round((0.35 + rnd() * 0.65) * n)));
      // Start somewhere in the first 60% of the window; finish inside it.
      const latestStart = Math.max(windowStartMs, windowEndMs - durationMs);
      const startedMs = windowStartMs + rnd() * Math.max(0, latestStart - windowStartMs);
      const usedMs = Math.min(durationMs, Math.round((0.3 + rnd() * 0.65) * durationMs));
      const submittedMs = Math.min(windowEndMs - 1000, startedMs + usedMs);

      entries.push({
        id: `demo-${test.id}-${person.clientId}`,
        clientId: person.clientId,
        title: test.title.en,
        filters: { ...EMPTY_FILTERS },
        problemIds: test.problemIds,
        durationMin: test.durationMin,
        status: "SUBMITTED",
        answers: [],
        score: correct,
        maxScore: n,
        correctCount: correct,
        startedAt: new Date(startedMs).toISOString(),
        submittedAt: new Date(submittedMs).toISOString(),
        timedOut: false,
        origin: "local",
        scheduledTestId: test.id,
        displayName: person.name,
      });
    });
  }

  return entries;
}
