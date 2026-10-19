export type Lang = "en" | "bn";

// The problem taxonomy lives with the data it describes so the bank, the UI
// vocabularies and the app types can never drift apart.
export type {
  Problem,
  ProblemType,
  ProblemTopic,
  ProblemCategory,
  ProblemDifficulty,
  Localized
} from "../data/types";

import type {
  Localized,
  Problem,
  ProblemCategory,
  ProblemDifficulty,
  ProblemTopic,
  ProblemType
} from "../data/types";

/* ------------------------------------------------------------------ */
/* Practice tests                                                      */
/* ------------------------------------------------------------------ */

/** The filter set used when a test was generated. Mirrors the UI builder. */
export interface TestFilters {
  types: ProblemType[];
  topics: ProblemTopic[];
  categories: ProblemCategory[];
  difficulties: ProblemDifficulty[];
}

export interface TestAnswer {
  problemId: string;
  given: string;
  correct: boolean;
  expected: string;
  points: number;
}

export type TestStatus = "IN_PROGRESS" | "SUBMITTED";

/** A practice test the learner built and sat. */
export interface PracticeTest {
  id: string;
  /** Anonymous browser id — lets us show "my past tests" without accounts. */
  clientId: string;
  title: string;
  filters: TestFilters;
  problemIds: string[];
  durationMin: number;
  status: TestStatus;
  answers: TestAnswer[];
  score: number;
  maxScore: number;
  correctCount: number;
  startedAt: string;
  submittedAt?: string;
  /** True when the countdown hit zero and the test was auto-submitted. */
  timedOut?: boolean;
  /** Where the record lives: "cloud" = Supabase, "local" = this browser. */
  origin: "cloud" | "local";
  /** Set when this entry belongs to a weekly/monthly scheduled test. */
  scheduledTestId?: string;
  /** Optional public name shown on the leaderboard for scheduled tests. */
  displayName?: string;
  /**
   * The signed-in learner account this entry was sat under. Boards only rank
   * entries that carry one, so anonymous local attempts stay on-device.
   */
  accountId?: string;
}

/* ------------------------------------------------------------------ */
/* Scheduled (weekly / monthly) tests + leaderboard                    */
/* ------------------------------------------------------------------ */

export type ScheduledTestKind = "WEEKLY" | "MONTHLY" | "CUSTOM";
export type TestPhase = "upcoming" | "live" | "ended";

/** A test published on a schedule — weekly, monthly or ad-hoc. */
export interface ScheduledTest {
  id: string;
  kind: ScheduledTestKind;
  title: Localized;
  description: Localized;
  /** ISO timestamps of the attempt window. */
  startAt: string;
  endAt: string;
  durationMin: number;
  problemIds: string[];
  published: boolean;
  /** Participants who have submitted (filled in by the API when known). */
  participants?: number;
}

/** One row of a per-test standings table. */
export interface StandingsRow {
  rank: number;
  entryId: string;
  name: string;
  clientId: string;
  /** Set when the attempt was sat under a signed-in account. */
  accountId?: string;
  score: number;
  maxScore: number;
  pct: number;
  timeTakenSec: number;
  submittedAt: string;
  isYou: boolean;
}

/** One row of the period leaderboard (weekly / monthly / all-time). */
export interface PeriodRow {
  rank: number;
  name: string;
  clientId: string;
  tests: number;
  correct: number;
  /** Problems solved correctly across the window — the ranking metric. */
  points: number;
  avgPct: number;
  bestPct: number;
  timeTakenSec: number;
  isYou: boolean;
}

export type LeaderboardWindow = "week" | "month" | "all";

/** A signed-in learner account — the server never sends the password hash. */
export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  /** Contact details captured at sign-up (absent on legacy accounts). */
  email?: string;
  phone?: string;
  createdAt: string;
}

/** Learner session: the bearer token plus the profile it belongs to. */
export interface Session {
  token: string;
  expiresAt: number;
  user: SessionUser;
}

/** Problem payload returned by the API (identical shape to the bundled bank). */
export type ApiProblem = Problem;
