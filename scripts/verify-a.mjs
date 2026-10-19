#!/usr/bin/env node
// Verifier for src/data/problems-a.json
// - asserts schema validity (fields, enums, unique ids/slugs, answer format)
// - independently recomputes the answer for (nearly) every problem with real code
// Usage: node scripts/verify-a.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "src", "data", "problems-a.json");

// ---------------------------------------------------------------------------
// BigInt helpers
// ---------------------------------------------------------------------------
const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

function modpow(base, exp, mod) {
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

function isqrt(n) {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

const isSquareBig = (n) => {
  if (n < 0n) return false;
  const r = isqrt(n);
  return r * r === n;
};

// Largest prime factor of a positive integer (trial division).
function largestPrimeFactor(n) {
  let last = 1n;
  while (n % 2n === 0n) {
    n /= 2n;
    last = 2n;
  }
  let f = 3n;
  while (f * f <= n) {
    while (n % f === 0n) {
      n /= f;
      last = f;
    }
    f += 2n;
  }
  if (n > 1n) last = n;
  return last;
}

// v_p(n): exponent of prime p in n.
function vp(n, p) {
  let k = 0;
  while (n % p === 0n) {
    n /= p;
    k++;
  }
  return k;
}

// Euler's totient by brute-force gcd counting.
function phiBrute(n) {
  let c = 0;
  for (let i = 1; i <= n; i++) {
    let a = BigInt(i);
    let b = BigInt(n);
    while (b) [a, b] = [b, a % b];
    if (a === 1n) c++;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Exact rational arithmetic (BigInt) for expected-value comparison
// ---------------------------------------------------------------------------
function toRational(str) {
  const m = /^(-?\d+)(?:\/(-?\d+))?$/.exec(str);
  if (!m) throw new Error(`bad numeric string: ${str}`);
  let num = BigInt(m[1]);
  let den = m[2] ? BigInt(m[2]) : 1n;
  if (den === 0n) throw new Error("zero denominator");
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den) || 1n;
  return { num: num / g, den: den / g };
}

const ratEq = (a, b) => a.num === b.num && a.den === b.den;
const rat = (n, d = 1n) => {
  const g = gcd(BigInt(n), BigInt(d)) || 1n;
  return { num: BigInt(n) / g, den: BigInt(d) / g };
};

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------
const TOPICS = ["NUMBER_THEORY", "ALGEBRA"];
const TYPES = ["ACADEMICS", "OLYMPIAD"];
const CATEGORIES = ["PRIMARY", "JUNIOR", "SECONDARY", "HIGHER_SECONDARY"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "OLYMPIAD"];
const DIFF_LETTER = { EASY: "e", MEDIUM: "m", HARD: "h", OLYMPIAD: "o" };
const TOPIC_PREFIX = { NUMBER_THEORY: "nt", ALGEBRA: "al" };
const ANSWER_RE = /^-?\d+(\.\d+)?(\/-?\d+)?$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID_RE = /^(nt|al)-[emho]-\d{2}$/;

const schemaErrors = [];

function check(cond, msg) {
  if (!cond) schemaErrors.push(msg);
}

function validateSchema(problems) {
  check(Array.isArray(problems), "root must be an array");
  check(problems.length === 48, `expected 48 problems, got ${problems.length}`);

  const ids = new Set();
  const slugs = new Set();
  const dist = {};

  for (const p of problems) {
    const label = p && p.id ? p.id : "<missing id>";
    for (const f of [
      "id", "slug", "type", "topic", "category", "difficulty",
      "title", "statement", "answer", "solution", "source",
    ]) {
      check(p[f] !== undefined, `${label}: missing field "${f}"`);
    }
    if (schemaErrors.length > 50) return; // avoid spam

    check(typeof p.id === "string" && ID_RE.test(p.id), `${label}: bad id format`);
    check(typeof p.slug === "string" && SLUG_RE.test(p.slug), `${label}: slug must be kebab-case`);
    check(TYPES.includes(p.type), `${label}: invalid type ${p.type}`);
    check(TOPICS.includes(p.topic), `${label}: invalid topic ${p.topic}`);
    check(CATEGORIES.includes(p.category), `${label}: invalid category ${p.category}`);
    check(DIFFICULTIES.includes(p.difficulty), `${label}: invalid difficulty ${p.difficulty}`);
    check(typeof p.answer === "string" && ANSWER_RE.test(p.answer), `${label}: bad answer "${p.answer}"`);
    check(typeof p.source === "string" && p.source.length > 0, `${label}: bad source`);

    if (typeof p.id === "string" && ID_RE.test(p.id)) {
      check(p.id.startsWith(TOPIC_PREFIX[p.topic] + "-"), `${label}: id prefix does not match topic`);
      check(p.id.split("-")[1] === DIFF_LETTER[p.difficulty], `${label}: id difficulty letter does not match difficulty`);
    }
    check(!ids.has(p.id), `${label}: duplicate id`);
    check(!slugs.has(p.slug), `${label}: duplicate slug`);
    ids.add(p.id);
    slugs.add(p.slug);

    for (const f of ["title", "statement", "solution"]) {
      const v = p[f];
      check(
        v && typeof v === "object" && typeof v.en === "string" && v.en.trim().length > 0 &&
          typeof v.bn === "string" && v.bn.trim().length > 0,
        `${label}: ${f} must have non-empty en and bn`
      );
    }

    const key = `${p.topic}/${p.difficulty}`;
    dist[key] = (dist[key] || 0) + 1;
  }

  for (const t of TOPICS) {
    for (const d of DIFFICULTIES) {
      check(dist[`${t}/${d}`] === 6, `distribution: ${t}/${d} should have 6 problems, got ${dist[`${t}/${d}`] || 0}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Independent computational re-checks, keyed by problem id.
// Each returns a canonical numeric string ("42", "99/100", ...).
// ---------------------------------------------------------------------------
function factorial(n) {
  let r = 1n;
  for (let i = 2n; i <= n; i++) r *= i;
  return r;
}

function sigma(n) {
  let s = 0;
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      s += d;
      if (d !== n / d) s += n / d;
    }
  }
  return String(s);
}

function divisorCount(n) {
  let c = 0;
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      c += 2;
      if (d === n / d) c--;
    }
  }
  return c;
}

function primeCountUpTo(N) {
  const sieve = new Array(N + 1).fill(true);
  sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= N; i++) {
    if (sieve[i]) for (let j = i * i; j <= N; j += i) sieve[j] = false;
  }
  return sieve.filter(Boolean).length;
}

function digitSum(n) {
  let s = 0;
  while (n > 0) {
    s += n % 10;
    n = Math.floor(n / 10);
  }
  return s;
}

// Add two BigInt rationals.
const addRat = (a, b) => rat(a.num * b.den + b.num * a.den, a.den * b.den);

const CHECKS = {
  "nt-e-01": () => {
    let s = 0n;
    for (let i = 1n; i <= 100n; i++) s += i;
    return String(s);
  },
  "nt-e-02": () => String(primeCountUpTo(100)),
  "nt-e-03": () => String(modpow(3n, 2024n, 10n)),
  "nt-e-04": () => String(gcd(84n, 120n)),
  "nt-e-05": () => String(vp(factorial(10n), 5n)),
  "nt-e-06": () => String(divisorCount(72)),
  "nt-m-01": () => String(modpow(2n, 100n, 7n)),
  "nt-m-02": () => {
    for (let n = 1; ; n++) if (n % 12 === 0 && n % 5 === 1) return String(n);
  },
  "nt-m-03": () => String(vp(factorial(100n), 5n)),
  "nt-m-04": () => sigma(96),
  "nt-m-05": () => String(largestPrimeFactor(2n ** 10n - 1n)),
  "nt-m-06": () => String(phiBrute(360)),
  "nt-h-01": () => {
    let s = 0n;
    for (let k = 1n; k <= 100n; k++) s += factorial(k);
    return String(s % 10n);
  },
  "nt-h-02": () => String(modpow(9n, 9n ** 9n, 100n)),
  "nt-h-03": () => String(factorial(100n) % 101n),
  "nt-h-04": () => String(vp(3n ** 16n - 1n, 2n)),
  "nt-h-05": () => {
    let c = 0;
    for (let n = 1; n <= 1000; n++) if ((n * (n + 1)) % 6 === 0) c++;
    return String(c);
  },
  "nt-h-06": () => {
    let v = 2n ** 100n;
    let digits = 0;
    while (v > 0n) {
      digits++;
      v /= 4n;
    }
    return String(digits);
  },
  "nt-o-01": () => String(largestPrimeFactor(2n ** 32n - 1n)),
  "nt-o-02": () => String(phiBrute(2024)),
  "nt-o-03": () => {
    // n^2+19n+92 lies strictly between consecutive squares outside [-11, -8];
    // brute force a far wider window to be safe.
    let sum = 0;
    for (let n = -2000; n <= 2000; n++) {
      const v = BigInt(n * n + 19 * n + 92);
      if (isSquareBig(v)) sum += n;
    }
    return String(sum);
  },
  "nt-o-04": () => String(vp(5n ** 99n + 1n, 3n)),
  "nt-o-05": () => {
    let c = 0;
    for (let n = 1; n <= 100000; n++) if (digitSum(n) % 9 === 0) c++;
    return String(c);
  },
  "nt-o-06": () => String(modpow(2n, 1000n, 1001n)),
  "al-e-01": () => String((23 - 7) / 2),
  "al-e-02": () => String((12 + 4) / 2),
  "al-e-03": () => {
    let s = 0;
    for (let k = 1; k <= 10; k++) s += k ** 3;
    return String(s);
  },
  "al-e-04": () => String(99 * 99 + 2 * 99 + 1),
  "al-e-05": () => {
    const roots = [];
    for (let x = -200; x <= 200; x++) if (x * x - 9 * x + 20 === 0) roots.push(x);
    return String(roots.reduce((a, b) => a * b, 1));
  },
  "al-e-06": () => String(3 + (5 - 1) * 4),
  "al-m-01": () => {
    let s = 0;
    for (let k = 0; k <= 10; k++) s += 2 ** k;
    return String(s);
  },
  "al-m-02": () => String(10 * 10 - 2 * 21),
  "al-m-03": () => String(5 * 5 - 2),
  "al-m-04": () => {
    let s = 0;
    for (let k = 1; k <= 10; k++) s += k * (k + 1);
    return String(s);
  },
  "al-m-05": () => {
    const roots = [];
    for (let x = -200; x <= 200; x++) if (x * x - 5 * x - 14 === 0) roots.push(x);
    return String(Math.min(...roots));
  },
  "al-m-06": () => {
    let s = rat(0n);
    for (let k = 1n; k <= 99n; k++) s = addRat(s, rat(1n, k * (k + 1n)));
    return `${s.num}/${s.den}`;
  },
  "al-h-01": () => {
    // s_n = x^n + x^{-n} satisfies s_n = s*s_{n-1} - s_{n-2}, s_0=2, s_1=3.
    let prev = 2n;
    let cur = 3n;
    for (let n = 2; n <= 3; n++) {
      [prev, cur] = [cur, 3n * cur - prev];
    }
    return String(cur);
  },
  "al-h-02": () => {
    // Multiply (x-1)(x-2)(x-3)(x-4); coefficient array ascending.
    let poly = [1n]; // constant 1
    for (const r of [1n, 2n, 3n, 4n]) {
      const next = new Array(poly.length + 1).fill(0n);
      for (let i = 0; i < poly.length; i++) {
        next[i] += -r * poly[i];
        next[i + 1] += poly[i];
      }
      poly = next;
    }
    // P(x) = x^4 + a x^3 + b x^2 + c x + d; a+b+c+d = sum of poly[0..3].
    const s = poly.slice(0, 4).reduce((acc, v) => acc + v, 0n);
    return String(s);
  },
  "al-h-03": () => {
    // Bisection for sqrt(x+5)+sqrt(x)=5 on [0, 100].
    const f = (x) => Math.sqrt(x + 5) + Math.sqrt(x) - 5;
    let lo = 0;
    let hi = 100;
    for (let i = 0; i < 300; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    const x = (lo + hi) / 2;
    if (Math.abs(f(x)) > 1e-9) throw new Error("al-h-03: no root found");
    return String(Math.round(x));
  },
  "al-h-04": () => {
    // a_1 = 1/1, a_{n+1} = 1/(1 + a_n), tracked exactly with BigInt.
    let p = 1n;
    let q = 1n;
    for (let n = 1; n < 10; n++) {
      // a = p/q  ->  1/(1 + p/q) = q/(p+q)
      [p, q] = [q, p + q];
      const g = gcd(p, q) || 1n;
      p /= g;
      q /= g;
    }
    return `${p}/${q}`;
  },
  "al-h-05": () => {
    // Brute-force roots of x^3-6x^2+11x-6, then sum 1/a+1/b+1/c.
    const roots = [];
    for (let x = -100; x <= 100; x++) {
      if (x ** 3 - 6 * x * x + 11 * x - 6 === 0) roots.push(BigInt(x));
    }
    if (roots.length !== 3) throw new Error("al-h-05: expected 3 roots");
    let s = rat(0n);
    for (const r of roots) s = addRat(s, rat(1n, r));
    return `${s.num}/${s.den}`;
  },
  "al-h-06": () => {
    // Numeric scan for min of x^2 + 64/x^2 on positive reals.
    let best = Infinity;
    for (let x = 0.01; x <= 20; x += 0.0001) {
      const v = x * x + 64 / (x * x);
      if (v < best) best = v;
    }
    return String(Math.round(best));
  },
  "al-o-01": () => {
    let s = rat(0n);
    for (let k = 1n; k <= 100n; k++) s = addRat(s, rat(1n, (2n * k - 1n) * (2n * k + 1n)));
    return `${s.num}/${s.den}`;
  },
  "al-o-02": () => {
    // x+y=5, xy=5: s2 = (x+y)^2-2xy, s4 = s2^2 - 2(xy)^2.
    const s2 = 5n * 5n - 2n * 5n;
    const s4 = s2 * s2 - 2n * (5n * 5n);
    return String(s4);
  },
  "al-o-03": () => {
    // Iterate x <- sqrt(10 + x) to convergence.
    let x = 0;
    for (let i = 0; i < 1000; i++) x = Math.sqrt(10 + x);
    if (Math.abs(x * x - x - 10) > 1e-9) throw new Error("al-o-03: not converged");
    return String(Math.round(x));
  },
  "al-o-04": () => {
    // Newton sums: s1 = 1, xy = -2, s_n = s1*s_{n-1} - xy*s_{n-2}; s_0 = 2.
    const s = [2n, 1n];
    for (let n = 2; n <= 5; n++) s.push(s[1] * s[n - 1] - -2n * s[n - 2]);
    return String(s[5]);
  },
  "al-o-05": () => {
    // Sum 1/(sqrt(k)+sqrt(k+1)), k=1..99, equals sqrt(100)-sqrt(1) = 9.
    let sum = 0;
    for (let k = 1; k <= 99; k++) sum += 1 / (Math.sqrt(k) + Math.sqrt(k + 1));
    if (Math.abs(sum - 9) > 1e-9) throw new Error(`al-o-05: numeric sum ${sum}`);
    return String(Math.round(sum));
  },
  "al-o-06": () => {
    // Count solutions of |x-1|+|x-2|+|x-3| = 4 by dense-grid sign changes.
    const g = (x) => Math.abs(x - 1) + Math.abs(x - 2) + Math.abs(x - 3) - 4;
    let count = 0;
    let prev = g(-10);
    const step = 1e-5;
    for (let x = -10 + step; x <= 10; x += step) {
      const cur = g(x);
      if (cur === 0 || cur * prev < 0) count++;
      prev = cur;
    }
    return String(count);
  },
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let problems;
try {
  problems = JSON.parse(readFileSync(dataPath, "utf8"));
} catch (e) {
  console.error(`FAIL: could not read/parse ${dataPath}: ${e.message}`);
  process.exit(1);
}

validateSchema(problems);

if (schemaErrors.length) {
  console.log(`SCHEMA: ${schemaErrors.length} error(s)`);
  for (const e of schemaErrors.slice(0, 40)) console.log(`  - ${e}`);
} else {
  console.log("SCHEMA: OK (48 problems, ids/slugs unique, enums valid, distribution 6 per topic/difficulty)");
}

const total = Array.isArray(problems) ? problems.length : 0;
let pass = 0;
const failures = [];
let unverified = [];

for (const p of problems) {
  const fn = CHECKS[p.id];
  if (!fn) {
    unverified.push(p.id);
    continue;
  }
  try {
    const computed = toRational(String(fn()));
    const expected = toRational(p.answer);
    if (ratEq(computed, expected)) {
      pass++;
    } else {
      failures.push(`${p.id}: json says ${p.answer}, recomputed ${computed.num}/${computed.den}`);
    }
  } catch (e) {
    failures.push(`${p.id}: checker error: ${e.message}`);
  }
}

const verified = pass + failures.length;
const pct = total ? Math.round((verified / total) * 100) : 0;

console.log(`\nVERIFIED: ${verified}/${total} problems recomputed by code (${pct}%); required >= 70%`);
if (unverified.length) console.log(`UNVERIFIED (no code check): ${unverified.join(", ")}`);
console.log(`PASS: ${pass}/${verified} checked answers match`);

if (failures.length) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
}

const ok = schemaErrors.length === 0 && failures.length === 0 && pct >= 70;
console.log(`\n${ok ? "PASS" : "FAIL"}: problems-a.json ${ok ? "is fully verified" : "has problems"}`);
process.exit(ok ? 0 : 1);

