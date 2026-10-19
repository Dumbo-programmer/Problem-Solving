/**
 * Schema + independent answer verification for src/data/problems-b.json
 *
 * Every problem's answer is recomputed from scratch by actual code
 * (brute force, DP, exact rational coordinate geometry, inclusion-exclusion
 * loops, integer square roots, ...). Computed and recorded answers are
 * compared as exact rationals.
 *
 * Run:  node scripts/verify-b.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "src", "data", "problems-b.json");

// ---------------------------------------------------------------------------
// exact rational helpers
// ---------------------------------------------------------------------------
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}
function R(n, d = 1) {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) {
    throw new Error(`not an integer rational: ${n}/${d}`);
  }
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const rAdd = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
const rSub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d);
const rMul = (a, b) => R(a.n * b.n, a.d * b.d);
const rDiv = (a, b) => R(a.n * b.d, a.d * b.n);
const rEq = (a, b) => a.n * b.d === b.n * a.d;
const rStr = (a) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);

function parseRational(s) {
  const m = /^(-?\d+)(?:\/(-?\d+))?$/.exec(s);
  if (!m) throw new Error(`bad answer format: "${s}"`);
  return R(Number(m[1]), m[2] === undefined ? 1 : Number(m[2]));
}

/** Exact integer square root; throws if n is not a perfect square. */
function isqrt(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`isqrt bad input ${n}`);
  const r = Math.round(Math.sqrt(n));
  if (r * r !== n) throw new Error(`${n} is not a perfect square`);
  return r;
}

function binom(n, k) {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  if (!Number.isInteger(r)) throw new Error(`binom(${n},${k}) not integral`);
  return r;
}
function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Section formula: point dividing XY so that X->P : P->Y = p : q. */
function divide(X, Y, p, q) {
  const den = R(p + q);
  return [
    rDiv(rAdd(rMul(X[0], R(q)), rMul(Y[0], R(p))), den),
    rDiv(rAdd(rMul(X[1], R(q)), rMul(Y[1], R(p))), den),
  ];
}

// ---------------------------------------------------------------------------
// independent recomputations, keyed by problem id
// ---------------------------------------------------------------------------
const RECOMPUTE = {
  // ---------------- GEOMETRY : EASY ----------------
  "ge-e-01": () => isqrt(8 * 8 + 15 * 15),                              // 17
  "ge-e-02": () => (14 * 9) / 2,                                        // 63
  "ge-e-03": () => 180 - 55 - 68,                                       // 57
  "ge-e-04": () => ((6 - 2) * 180) / 6,                                 // 120
  "ge-e-05": () => isqrt(10 * 10 - 6 * 6),                              // 8
  "ge-e-06": () => isqrt(36),                                           // 6 (pi r^2 = 36 pi)

  // ---------------- GEOMETRY : MEDIUM ----------------
  "ge-m-01": () => (12 * 12) / 8,                                       // PB = 18
  "ge-m-02": () => {
    const ratio = R(6, 10);                       // AD/AB
    const big = rDiv(R(36), rMul(ratio, ratio));  // area(ABC)
    return rSub(big, R(36));                      // trapezoid area
  },
  "ge-m-03": () => isqrt(rDiv(R(2 * 81 + 2 * 49 - 64), R(4)).n),        // median = 7
  "ge-m-04": () => (4 * 6) / 3,                                         // PD = 8
  "ge-m-05": () => isqrt(21 * 8 * 7 * 6),                               // Heron = 84
  "ge-m-06": () => (17 * 17 - 169) / 2,                                 // ab = 60

  // ---------------- GEOMETRY : HARD ----------------
  "ge-h-01": () => isqrt(11 * 11 + 4 * 12),                             // Ptolemy d = 13
  "ge-h-02": () => {
    const h = isqrt(5 * 5 - ((16 - 10) / 2) ** 2);
    return ((10 + 16) * h) / 2;
  },
  "ge-h-03": () => {
    const power = 10 * 10 - 6 * 6;
    const pb = power / 4;
    return pb - 4;
  },
  "ge-h-04": () => {                                                    // shoelace
    const P = [[0, 0], [6, 2], [7, 6], [1, 5]];
    let s1 = 0, s2 = 0;
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      s1 += P[i][0] * P[j][1];
      s2 += P[i][1] * P[j][0];
    }
    return R(Math.abs(s1 - s2), 2);
  },
  "ge-h-05": () => isqrt(13 * 13 - 5 * 5) - isqrt(13 * 13 - 12 * 12),
  "ge-h-06": () => R(25 * 20, 20 + 15),                                 // angle bisector

  // ---------------- GEOMETRY : OLYMPIAD ----------------
  "ge-o-01": () => {                                                    // exact coordinates
    const A = [R(0), R(0)], B = [R(0), R(5)], C = [R(5), R(0)];
    const D = divide(B, C, 3, 2);                                       // BD:DC = 3:2
    const E = divide(A, C, 1, 4);                                       // AE:EC = 1:4
    // line AD: t*D ;  line BE: B + s*(E-B).  Solve exactly:
    //   x: t*Dx = s*Ex   =>  s = t*(Dx/Ex)
    //   y: t*Dy = By + s*(Ey - By)
    const kx = rDiv(D[0], E[0]);                 // s = t * kx
    const t = rDiv(B[1], rSub(D[1], rMul(kx, rSub(E[1], B[1]))));
    return rDiv(t, rSub(R(1), t));               // AP/PD
  },
  "ge-o-02": () => {                                                    // R = abc/(4K)
    const s = (10 + 10 + 12) / 2;
    const K = isqrt(s * (s - 10) * (s - 10) * (s - 12));
    return rDiv(R(10 * 10 * 12), R(4 * K));
  },
  "ge-o-03": () => isqrt((4 + 9) ** 2 - (9 - 4) ** 2),                  // XY = 12
  "ge-o-04": () => isqrt(13 - 9),                                       // cross-section r
  "ge-o-05": () => {                                                    // P=(-25,0), R=(25,0)
    const rad = 25;
    const onCircle = (distFromP) => {                   // x = (d^2 - 2r^2)/(2r)
      const x = R(distFromP * distFromP - 2 * rad * rad, 2 * rad);
      const y2 = rSub(R(rad * rad), rMul(x, x));
      const yn = isqrt(y2.n), yd = isqrt(y2.d);
      return [x, R(yn, yd)];
    };
    const Q = onCircle(30);                              // PQ = 30
    const S = onCircle(14);                              // SP = 14
    const dx = rSub(Q[0], S[0]);
    const dy = rAdd(Q[1], S[1]);                         // opposite sides of PR
    const d2 = rAdd(rMul(dx, dx), rMul(dy, dy));
    if (d2.d !== 1) throw new Error(`QS^2 not an integer: ${rStr(d2)}`);
    return isqrt(d2.n);
  },
  "ge-o-06": () => {                                                    // trapezoid coords
    const A = [R(0), R(0)], D = [R(6), R(0)], B = [R(-2), R(1)], C = [R(12), R(1)];
    // diagonal AC: A + t(C-A);  diagonal BD: B + s(D-B)
    // y: t*1 = 1 - s  =>  s = 1 - t ;  x: 12t = -2 + 8s  =>  20t = 6
    const t = rDiv(R(6), R(20));
    const pY = t;                                       // P height in units of h
    const h = rDiv(R(9), rMul(R(1, 2), rMul(R(6), pY)));   // from [APD] = 9
    return rMul(R(1, 2), rMul(R(14), rMul(rSub(R(1), pY), h)));  // [BPC]
  },

  // ---------------- COMBINATORICS : EASY ----------------
  "co-e-01": () => binom(10, 3),
  "co-e-02": () => factorial(5) / 2,                                   // APPLE = 60
  "co-e-03": () => binom(10, 2),
  "co-e-04": () => { let n = 0; for (let s = 1; s <= 3; s++) n += (4 - s) ** 2; return n; },
  "co-e-05": () => 2 ** 5,
  "co-e-06": () => 8 * 7,

  // ---------------- COMBINATORICS : MEDIUM ----------------
  "co-m-01": () => {                                                   // brute force
    let n = 0;
    for (let x = 0; x <= 15; x++)
      for (let y = 0; y <= 15 - x; y++) if (15 - x - y >= 0) n++;
    return n;
  },
  "co-m-02": () => {                                                   // DP lattice paths
    const W = 6, H = 4;
    const dp = Array.from({ length: W + 1 }, () => new Array(H + 1).fill(0));
    dp[0][0] = 1;
    for (let i = 0; i <= W; i++)
      for (let j = 0; j <= H; j++) {
        if (i === 0 && j === 0) continue;
        dp[i][j] = (i > 0 ? dp[i - 1][j] : 0) + (j > 0 ? dp[i][j - 1] : 0);
      }
    return dp[W][H];
  },
  "co-m-03": () => { let n = 0; for (let i = 1; i <= 200; i++) if (i % 3 === 0 || i % 5 === 0) n++; return n; },
  "co-m-04": () => {                                                   // brute force permutations, rotation dedupe
    const perms = [];
    const permute = (arr, cur) => {
      if (!arr.length) { perms.push(cur); return; }
      for (let i = 0; i < arr.length; i++)
        permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, arr[i]]);
    };
    permute([0, 1, 2, 3, 4, 5], []);
    const seen = new Set();
    for (const p of perms) {
      const rotations = [];
      for (let k = 0; k < 6; k++) rotations.push([...p.slice(k), ...p.slice(0, k)].join(""));
      seen.add(rotations.sort()[0]);
    }
    return seen.size;
  },
  "co-m-05": () => {                                                   // DP stair climbing
    const f = [1, 1, 2];
    for (let i = 3; i <= 8; i++) f[i] = f[i - 1] + f[i - 2];
    return f[8];
  },
  "co-m-06": () => (2n ** 50n).toString().length,                      // digits of 2^50

  // ---------------- COMBINATORICS : HARD ----------------
  "co-h-01": () => {                                                   // inclusion-exclusion
    const c = (d) => Math.floor(300 / d);
    return c(2) + c(3) + c(5) - c(6) - c(10) - c(15) + c(30);
  },
  "co-h-02": () => {                                                   // brute force 7! permutations
    const a = [0, 1, 2, 3, 4, 5, 6];
    let count = 0;
    const permute = (arr, cur) => {
      if (!arr.length) { if (cur.every((v, i) => v !== i)) count++; return; }
      for (let i = 0; i < arr.length; i++)
        permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, arr[i]]);
    };
    permute(a, []);
    return count;
  },
  "co-h-03": () => {                                                   // brute force 2^10 strings
    let count = 0;
    for (let m = 0; m < 1 << 10; m++) {
      let ok = true;
      for (let i = 0; i < 9; i++) if (!(m & (1 << i)) && !(m & (1 << (i + 1)))) { ok = false; break; }
      if (ok) count++;
    }
    return count;
  },
  "co-h-04": () => {                                                   // brute force 3^5 strings
    let count = 0;
    const digits = [1, 2, 3];
    const walk = (len, used) => {
      if (len === 5) { if (used === 7) count++; return; }
      for (const d of digits) walk(len + 1, used | (1 << (d - 1)));
    };
    walk(0, 0);
    return count;
  },
  "co-h-05": () => binom(20, 10) - binom(10, 5) ** 2,                  // paths avoiding (5,5)
  "co-h-06": () => {                                                   // brute force digit triples
    let n = 0;
    for (let a = 0; a <= 9; a++)
      for (let b = 0; b <= 9; b++)
        for (let c = 0; c <= 9; c++) if (a + b + c === 10) n++;
    return n;
  },

  // ---------------- COMBINATORICS : OLYMPIAD ----------------
  "co-o-01": () => {                                                   // brute force 2^10 subsets
    let count = 0;
    for (let m = 0; m < 1 << 10; m++) {
      let s = 0;
      for (let i = 0; i < 10; i++) if (m & (1 << i)) s += i + 1;
      if (s > 27) count++;
    }
    return count;
  },
  "co-o-02": () => {                                                   // DP, never above y = x
    const n = 8;
    const dp = Array.from({ length: n + 1 }, (_, i) =>
      Array.from({ length: i + 1 }, () => 0));
    const at = (i, j) => (i >= 0 && j >= 0 && j <= i ? dp[i][j] : 0);
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= i; j++) {
        if (i === 0 && j === 0) { dp[i][j] = 1; continue; }
        dp[i][j] = at(i - 1, j) + at(i, j - 1);
      }
    }
    return dp[n][n];
  },
  "co-o-03": () => {                                                   // pairs {k, 31-k}
    const pairs = [];
    for (let k = 1; k <= 15; k++) pairs.push([k, 31 - k]);
    let best = 0;
    for (let mask = 0; mask < 1 << 15; mask++) {   // choose one element per pair
      const chosen = pairs.map((p, i) => (mask & (1 << i) ? p[0] : p[1]));
      let ok = true;
      for (let i = 0; i < chosen.length && ok; i++)
        for (let j = i + 1; j < chosen.length; j++)
          if (chosen[i] + chosen[j] === 31) { ok = false; break; }
      if (ok) best = Math.max(best, chosen.length);
    }
    return best + 1;                                                   // pigeonhole
  },
  "co-o-04": () => {                                                   // DP compositions with parts 1,2,3
    const f = [1];
    for (let i = 1; i <= 10; i++)
      f[i] = (f[i - 1] || 0) + (f[i - 2] || 0) + (f[i - 3] || 0);
    return f[10];
  },
  "co-o-05": () => {                                                   // brute force 4-digit numbers
    let count = 0;
    for (let x = 1000; x <= 9999; x++) {
      const d = String(x).split("").map(Number);
      if (d[0] < d[1] && d[1] < d[2] && d[2] < d[3]) count++;
    }
    return count;
  },
  "co-o-06": () => {                                                   // brute force triples of grid points
    const pts = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) pts.push([c, r]);
    let total = 0, collinear = 0;
    for (let i = 0; i < 16; i++)
      for (let j = i + 1; j < 16; j++)
        for (let k = j + 1; k < 16; k++) {
          total++;
          const [ax, ay] = pts[i], [bx, by] = pts[j], [cx, cy] = pts[k];
          if ((bx - ax) * (cy - ay) === (by - ay) * (cx - ax)) collinear++;
        }
    if (total !== binom(16, 3)) throw new Error("triple enumeration broken");
    return total - collinear;
  },
};

// ---------------------------------------------------------------------------
// schema validation
// ---------------------------------------------------------------------------
const TOPICS = new Set(["GEOMETRY", "COMBINATORICS"]);
const TYPES = new Set(["ACADEMICS", "OLYMPIAD"]);
const CATEGORIES = new Set(["PRIMARY", "JUNIOR", "SECONDARY", "HIGHER_SECONDARY"]);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD", "OLYMPIAD"]);
const ANSWER_RE = /^-?\d+(\.\d+)?(\/-?\d+)?$/;
const ID_RE = /^(ge|co)-(e|m|h|o)-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PREFIX_TOPIC = { ge: "GEOMETRY", co: "COMBINATORICS" };
const LETTER_DIFF = { e: "EASY", m: "MEDIUM", h: "HARD", o: "OLYMPIAD" };
const STR = (v) => typeof v === "string" && v.length > 0;

function validateSchema(problems) {
  const errors = [];
  const ids = new Set(), slugs = new Set();

  if (!Array.isArray(problems)) return ["top-level value must be an array"];
  if (problems.length !== 48) errors.push(`expected 48 problems, got ${problems.length}`);

  problems.forEach((p, idx) => {
    const tag = (m) => errors.push(`[${idx}] ${p && p.id ? p.id : "?"}: ${m}`);
    if (typeof p !== "object" || p === null) return tag("not an object");

    for (const f of ["id", "slug", "type", "topic", "category", "difficulty", "title", "statement", "answer", "solution", "source"]) {
      if (!(f in p)) tag(`missing field "${f}"`);
    }

    if (typeof p.id === "string") {
      if (ids.has(p.id)) tag("duplicate id");
      ids.add(p.id);
      const m = ID_RE.exec(p.id);
      if (!m) tag("id does not match ^ge|co + difficulty letter + 2 digits");
      else {
        if (PREFIX_TOPIC[p.id.slice(0, 2)] !== p.topic) tag("id prefix does not match topic");
        if (LETTER_DIFF[p.id[3]] !== p.difficulty) tag("id difficulty letter does not match difficulty");
      }
    }

    if (typeof p.slug === "string") {
      if (slugs.has(p.slug)) tag("duplicate slug");
      slugs.add(p.slug);
      if (!SLUG_RE.test(p.slug)) tag("slug not kebab-case");
    }

    if (!TYPES.has(p.type)) tag(`invalid type "${p.type}"`);
    if (!TOPICS.has(p.topic)) tag(`invalid topic "${p.topic}"`);
    if (!CATEGORIES.has(p.category)) tag(`invalid category "${p.category}"`);
    if (!DIFFICULTIES.has(p.difficulty)) tag(`invalid difficulty "${p.difficulty}"`);
    if (!STR(p.source)) tag("source must be a non-empty string");

    for (const f of ["title", "statement", "solution"]) {
      const o = p[f];
      if (typeof o !== "object" || o === null) { tag(`"${f}" must be an object`); continue; }
      if (!STR(o.en)) tag(`"${f}".en must be a non-empty string`);
      if (!STR(o.bn)) tag(`"${f}".bn must be a non-empty string`);
    }

    if (typeof p.answer !== "string" || !ANSWER_RE.test(p.answer)) {
      tag(`answer "${p.answer}" must be a plain number/fraction string`);
    } else {
      parseRational(p.answer); // also catches d = 0
    }
  });

  // required distribution: 2 topics x 4 difficulties x 6 problems
  for (const t of TOPICS) {
    for (const d of DIFFICULTIES) {
      const n = problems.filter((p) => p.topic === t && p.difficulty === d).length;
      if (n !== 6) errors.push(`distribution: ${t}/${d} has ${n} problems (expected 6)`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const schemaErrors = [];
  let problems = [];
  try {
    problems = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    console.error(`FAIL: cannot read ${FILE}: ${e.message}`);
    process.exit(1);
  }

  schemaErrors.push(...validateSchema(problems));

  const checked = [];
  const failures = [];
  const unverified = [];

  for (const p of problems) {
    const fn = RECOMPUTE[p.id];
    if (!fn) { unverified.push(p.id); continue; }
    checked.push(p.id);
    try {
      const raw = fn();
      const computed = typeof raw === "number" ? R(raw) : raw;
      const recorded = parseRational(p.answer);
      if (!rEq(computed, recorded)) {
        failures.push(`${p.id}: recorded ${p.answer} (${rStr(recorded)}), computed ${rStr(computed)}`);
      }
    } catch (e) {
      failures.push(`${p.id}: recomputation threw: ${e.message}`);
    }
  }

  const total = problems.length;
  const required = Math.ceil(total * 0.7);
  if (checked.length < required) {
    schemaErrors.push(`only ${checked.length}/${total} problems verified, need at least ${required} (70%)`);
  }

  console.log("=== problems-b.json verification ===");
  console.log(`problems           : ${total}`);
  console.log(`schema errors      : ${schemaErrors.length}`);
  console.log(`recomputed answers : ${checked.length}/${total} (${((checked.length / total) * 100).toFixed(1)}%)`);
  console.log(`answer mismatches  : ${failures.length}`);
  if (unverified.length) console.log(`not recomputed     : ${unverified.join(", ")}`);

  for (const e of schemaErrors) console.log(`  SCHEMA  ${e}`);
  for (const f of failures) console.log(`  ANSWER  ${f}`);

  const ok = schemaErrors.length === 0 && failures.length === 0;
  console.log(ok ? "\nPASS: all checks succeeded." : "\nFAIL: see errors above.");
  process.exit(ok ? 0 : 1);
}

main();
