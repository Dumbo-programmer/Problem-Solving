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
}

/** Problem payload returned by the API (identical shape to the bundled bank). */
export type ApiProblem = Problem;
