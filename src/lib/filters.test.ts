import { describe, expect, it } from "vitest";
import { filterProblems, pickProblems, seededShuffle } from "./filters";
import type { Problem } from "./types";

const make = (over: Partial<Problem>): Problem => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  slug: over.slug ?? "x",
  type: over.type ?? "ACADEMICS",
  topic: over.topic ?? "ALGEBRA",
  category: over.category ?? "JUNIOR",
  difficulty: over.difficulty ?? "EASY",
  title: over.title ?? { en: "t", bn: "t" },
  statement: over.statement ?? { en: "s", bn: "s" },
  answer: over.answer ?? "1",
  solution: over.solution ?? { en: "s", bn: "s" },
  source: over.source ?? "test"
});

describe("filterProblems", () => {
  const bank = [
    make({ id: "1", topic: "ALGEBRA", difficulty: "EASY" }),
    make({ id: "2", topic: "GEOMETRY", difficulty: "HARD" }),
    make({ id: "3", topic: "ALGEBRA", difficulty: "HARD", type: "OLYMPIAD" })
  ];

  it("returns everything when no facet is set", () => {
    expect(filterProblems(bank, {})).toHaveLength(3);
  });

  it("treats an empty selection as 'any'", () => {
    expect(filterProblems(bank, { topics: [], difficulties: [] })).toHaveLength(3);
  });

  it("filters by a single facet", () => {
    expect(filterProblems(bank, { topics: ["ALGEBRA"] }).map((p) => p.id)).toEqual(["1", "3"]);
    expect(filterProblems(bank, { difficulties: ["HARD"] }).map((p) => p.id)).toEqual(["2", "3"]);
  });

  it("ANDs across facets, ORs within a facet", () => {
    expect(filterProblems(bank, { topics: ["ALGEBRA"], difficulties: ["HARD"] }).map((p) => p.id)).toEqual(["3"]);
    expect(filterProblems(bank, { topics: ["ALGEBRA", "GEOMETRY"] })).toHaveLength(3);
  });

  it("matches free-text search against title and source", () => {
    const bank2 = [make({ id: "9", title: { en: "Fermat's little theorem", bn: "x" }, source: "Classic" })];
    expect(filterProblems(bank2, { search: "fermat" })).toHaveLength(1);
    expect(filterProblems(bank2, { search: "classic" })).toHaveLength(1);
    expect(filterProblems(bank2, { search: "zzz" })).toHaveLength(0);
  });
});

describe("seededShuffle", () => {
  it("is deterministic for a given seed", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
  });

  it("is a permutation (never drops or duplicates)", () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    expect([...seededShuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });

  it("actually reorders for different seeds", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(items, 1)).not.toEqual(seededShuffle(items, 2));
  });
});

describe("pickProblems", () => {
  const pool = [
    ...Array.from({ length: 8 }, (_, i) => make({ id: `e${i}`, difficulty: "EASY" })),
    ...Array.from({ length: 8 }, (_, i) => make({ id: `m${i}`, difficulty: "MEDIUM" })),
    ...Array.from({ length: 8 }, (_, i) => make({ id: `h${i}`, difficulty: "HARD" }))
  ];

  it("returns the whole pool when it is smaller than the request", () => {
    expect(pickProblems(pool, 100, 5)).toHaveLength(24);
  });

  it("returns exactly the requested count", () => {
    expect(pickProblems(pool, 10, 5)).toHaveLength(10);
  });

  it("never repeats a problem", () => {
    const picked = pickProblems(pool, 12, 99);
    expect(new Set(picked.map((p) => p.id)).size).toBe(picked.length);
  });

  it("spreads difficulties evenly", () => {
    const picked = pickProblems(pool, 9, 3);
    const tally = picked.reduce<Record<string, number>>((acc, p) => {
      acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
      return acc;
    }, {});
    expect(tally.EASY).toBe(3);
    expect(tally.MEDIUM).toBe(3);
    expect(tally.HARD).toBe(3);
  });
});
