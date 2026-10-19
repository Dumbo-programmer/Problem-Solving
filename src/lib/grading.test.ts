import { describe, expect, it } from "vitest";
import { formatAnswer, gradeAnswer, parseAnswer } from "./grading";

describe("parseAnswer", () => {
  it("parses plain integers", () => {
    expect(parseAnswer("42")).toEqual({ kind: "rational", n: 42, d: 1 });
    expect(parseAnswer("-7")).toEqual({ kind: "rational", n: -7, d: 1 });
  });

  it("tolerates whitespace and thousands separators", () => {
    expect(parseAnswer("  5,050 ")).toEqual({ kind: "rational", n: 5050, d: 1 });
  });

  it("parses fractions and reduces them", () => {
    expect(parseAnswer("6/4")).toEqual({ kind: "rational", n: 3, d: 2 });
    expect(parseAnswer("-3/6")).toEqual({ kind: "rational", n: -1, d: 2 });
  });

  it("parses decimals exactly (no float drift)", () => {
    expect(parseAnswer("2.5")).toEqual({ kind: "rational", n: 5, d: 2 });
    expect(parseAnswer("0.1")).toEqual({ kind: "rational", n: 1, d: 10 });
  });

  it("rejects non-numeric input", () => {
    expect(parseAnswer("banana")).toBeNull();
    expect(parseAnswer("12 cm")).toBeNull();
    expect(parseAnswer("")).toBeNull();
    expect(parseAnswer("1/2/3")).toBeNull();
  });
});

describe("gradeAnswer", () => {
  it("accepts exactly equal answers", () => {
    expect(gradeAnswer("5050", "5050").correct).toBe(true);
  });

  it("accepts equivalent fractions", () => {
    expect(gradeAnswer("0.5", "1/2").correct).toBe(true);
    expect(gradeAnswer("2/4", "1/2").correct).toBe(true);
    expect(gradeAnswer("1/3", "2/6").correct).toBe(true);
  });

  it("rejects wrong answers and flags blanks", () => {
    expect(gradeAnswer("5051", "5050").correct).toBe(false);
    const blank = gradeAnswer("", "5050");
    expect(blank.correct).toBe(false);
    expect(blank.interpretable).toBe(false);
  });

  it("handles negative answers", () => {
    expect(gradeAnswer("-3", "-3").correct).toBe(true);
    expect(gradeAnswer("-3", "3").correct).toBe(false);
  });

  it("accepts a decimal typed for an exact decimal answer", () => {
    expect(gradeAnswer("2.25", "2.25").correct).toBe(true);
    expect(gradeAnswer("2.251", "2.25").correct).toBe(false);
  });
});

describe("formatAnswer", () => {
  it("prints integers without a denominator", () => {
    expect(formatAnswer({ kind: "rational", n: 12, d: 1 })).toBe("12");
    expect(formatAnswer({ kind: "rational", n: 3, d: 4 })).toBe("3/4");
  });
});
