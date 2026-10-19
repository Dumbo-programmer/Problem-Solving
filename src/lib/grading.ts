/**
 * Answer parsing & grading.
 *
 * Learners type answers in many shapes ("5,050", " 3/4 ", "2.5", "0.75").
 * We normalise both the given and the expected answer into exact rationals so
 * grading is forgiving but never wrong.
 */

export interface ParsedAnswer {
  kind: "rational";
  /** numerator / denominator, denominator > 0, fully reduced. */
  n: number;
  d: number;
}

const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

/** Convert a decimal string into an exact fraction (avoids float drift). */
function decimalToFraction(raw: string): ParsedAnswer | null {
  const m = raw.match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const intPart = m[2] || "0";
  const fracPart = m[3] || "";
  const denom = 10 ** fracPart.length;
  const n = sign * Number(intPart + fracPart || "0");
  if (!Number.isFinite(n)) return null;
  return reduce(n, denom);
}

function reduce(n: number, d: number): ParsedAnswer {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { kind: "rational", n: n / g, d: d / g };
}

/**
 * Parse a user- or author-supplied answer into an exact rational.
 * Returns null when the string is not a number we can grade.
 */
export function parseAnswer(input: string): ParsedAnswer | null {
  if (typeof input !== "string") return null;
  // Strip spaces, thousands separators and common trailing punctuation.
  let s = input.trim().replace(/\s+/g, "").replace(/,/g, "");
  if (!s) return null;

  // Reject anything that still contains letters or symbols (no unit guessing).
  if (/[^0-9.+\-*/]/.test(s)) return null;

  // Fraction: a/b
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length !== 2) return null;
    const num = decimalToFraction(parts[0]);
    const den = decimalToFraction(parts[1]);
    if (!num || !den || den.n === 0) return null;
    // (n1/d1) / (n2/d2) = n1*d2 / d1*n2
    return reduce(num.n * den.d, num.d * den.n);
  }

  if (s.includes(".")) return decimalToFraction(s);
  if (!NUMBER_RE.test(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return reduce(v, 1);
}

/** Value of a parsed answer as a JS number (for display / comparisons). */
export function rationalToNumber(a: ParsedAnswer): number {
  return a.n / a.d;
}

/** Display a parsed answer nicely — integer when it is one. */
export function formatAnswer(a: ParsedAnswer): string {
  if (a.d === 1) return String(a.n);
  return `${a.n}/${a.d}`;
}

export interface GradeResult {
  correct: boolean;
  /** null when the given answer could not be interpreted at all. */
  interpretable: boolean;
}

/**
 * Grade a given answer against the canonical one.
 *
 * - Exact rational equality is the goal.
 * - A small tolerance covers decimal input of exact values (e.g. 0.33333 for 1/3
 *   is still wrong, but 1.4142 for √2 typed as decimal is accepted when the
 *   canonical answer itself is a decimal).
 */
export function gradeAnswer(given: string, expected: string, tolerance = 1e-6): GradeResult {
  const exp = parseAnswer(expected);
  if (!exp) {
    // Non-numeric canonical answer → fall back to a normalised string compare.
    const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
    const g = norm(given);
    if (!g) return { correct: false, interpretable: false };
    return { correct: g === norm(expected), interpretable: true };
  }

  const giv = parseAnswer(given);
  if (!giv) {
    // Could be an empty or nonsense entry.
    if (!given.trim()) return { correct: false, interpretable: false };
    return { correct: false, interpretable: false };
  }

  if (giv.n === exp.n && giv.d === exp.d) return { correct: true, interpretable: true };

  const diff = Math.abs(rationalToNumber(giv) - rationalToNumber(exp));
  const scale = Math.max(1, Math.abs(rationalToNumber(exp)));
  return { correct: diff <= tolerance * scale, interpretable: true };
}
