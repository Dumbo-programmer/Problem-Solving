import type { Problem, TestFilters } from "./types";
import { DIFFICULTIES, type ProblemDifficulty } from "../data/types";

/** Empty filter state — "everything is selected". */
export const EMPTY_FILTERS: TestFilters = {
  types: [],
  topics: [],
  categories: [],
  difficulties: []
};

export interface FilterState extends TestFilters {
  search: string;
  /** null = no explicit count; the builder lets the user pick. */
  limit: number | null;
}

export const EMPTY_FILTER_STATE: FilterState = {
  ...EMPTY_FILTERS,
  search: "",
  limit: null
};

function inGroup<T extends string>(selected: T[], value: T): boolean {
  return selected.length === 0 || selected.includes(value);
}

/** Apply the taxonomy filters (plus an optional free-text search) to the bank. */
export function filterProblems(problems: Problem[], f: Partial<TestFilters> & { search?: string }): Problem[] {
  const search = (f.search ?? "").trim().toLowerCase();
  return problems.filter((p) => {
    if (!inGroup(f.types ?? [], p.type)) return false;
    if (!inGroup(f.topics ?? [], p.topic)) return false;
    if (!inGroup(f.categories ?? [], p.category)) return false;
    if (!inGroup(f.difficulties ?? [], p.difficulty)) return false;
    if (search) {
      const hay = `${p.title.en} ${p.title.bn} ${p.statement.en} ${p.statement.bn} ${p.source} ${p.slug}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

/** Difficulty ordering helper (Easy < Medium < Hard < Olympiad). */
export function difficultyRank(d: ProblemDifficulty): number {
  return DIFFICULTIES.find((x) => x.key === d)?.rank ?? 0;
}

/**
 * Deterministic-but-varied shuffle used when auto-picking problems for a test.
 * Seeded so a reload of the same builder config doesn't silently reshuffle.
 */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = items.slice();
  let s = seed >>> 0 || 1;
  const rand = () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick problems for a new test: shuffle the filtered pool, then take up to
 * `count`, trying to keep an even spread across difficulties when possible.
 */
export function pickProblems(pool: Problem[], count: number, seed = Date.now()): Problem[] {
  if (pool.length <= count) return seededShuffle(pool, seed);
  const shuffled = seededShuffle(pool, seed);
  const byDiff = new Map<ProblemDifficulty, Problem[]>();
  for (const p of shuffled) {
    const list = byDiff.get(p.difficulty) ?? [];
    list.push(p);
    byDiff.set(p.difficulty, list);
  }
  // Round-robin across difficulties (Easy → Olympiad) for a balanced paper.
  const order = (["EASY", "MEDIUM", "HARD", "OLYMPIAD"] as ProblemDifficulty[]).filter((d) => byDiff.has(d));
  const picked: Problem[] = [];
  let idx = 0;
  while (picked.length < count) {
    let added = false;
    for (const d of order) {
      const list = byDiff.get(d)!;
      if (idx < list.length) {
        picked.push(list[idx]);
        added = true;
        if (picked.length >= count) break;
      }
    }
    if (!added) break;
    idx++;
  }
  return picked;
}

/** Short human label for a filter set, used as the default test title. */
export function describeFilters(f: TestFilters, labels: { topic: (t: string) => string; difficulty: (d: string) => string; type: (t: string) => string; category: (c: string) => string }): string {
  const parts: string[] = [];
  if (f.types.length === 1) parts.push(labels.type(f.types[0]));
  if (f.topics.length >= 1 && f.topics.length <= 2) parts.push(f.topics.map(labels.topic).join(" + "));
  if (f.categories.length === 1) parts.push(labels.category(f.categories[0]));
  if (f.difficulties.length >= 1 && f.difficulties.length <= 2) parts.push(f.difficulties.map(labels.difficulty).join(" + "));
  return parts.length ? parts.join(" · ") : "Mixed practice";
}
