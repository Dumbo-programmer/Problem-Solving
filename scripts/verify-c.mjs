/**
 * Verifier for src/data/problems-c.json (INEQUALITY + PROBABILITY, 48 problems).
 *
 * 1. Asserts schema validity (fields, enums, unique ids/slugs, answer format).
 * 2. Independently recomputes the answer for 100% of the problems with real
 *    code (brute-force enumeration / grid search over the reals) and compares.
 *
 * Run:  node scripts/verify-c.mjs     (exit code 0 = PASS, 1 = FAIL)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "src", "data", "problems-c.json");

const TOL = 1e-6; // grid searches compare as reals within this tolerance
const errors = [];

/* ------------------------------------------------------------------ helpers */

const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};
const reduce = (n, d) => [n / gcd(n, d), d / gcd(n, d)];
/** "3/4" | "7" | "2.5" -> [numerator, denominator] */
function answerRat(str) {
  const [n, d] = str.split("/");
  return [Number(n), d === undefined ? 1 : Number(d)];
}
/** exact fraction addition on integers: [n1,d1] + [n2,d2] */
const addRat = ([n1, d1], [n2, d2]) => reduce(n1 * d2 + n2 * d1, d1 * d2);

/* --------------------------------------------------------- check primitives */

/** Grid-search style check: computed real number must equal the JSON answer. */
function checkValue(id, value) {
  const p = problemsById.get(id);
  const [n, d] = answerRat(p.answer);
  const target = n / d;
  if (!(Math.abs(value - target) <= TOL)) {
    errors.push(`${id}: computed ${value} != answer ${p.answer}`);
    return false;
  }
  return true;
}

/** Counting check: computed fraction n/d must reduce to a/b whose a+b (or p+q)
 *  equals the JSON answer. This is how every probability problem is phrased. */
function checkSum(id, n, d) {
  const p = problemsById.get(id);
  const [rn, rd] = reduce(n, d);
  const sum = rn + rd;
  if (String(sum) !== p.answer) {
    errors.push(`${id}: computed fraction ${rn}/${rd} -> sum ${sum} != answer ${p.answer}`);
    return false;
  }
  return true;
}

/** The problem states "the value is a/b in lowest terms; find a + b".
 *  Verify the computed real number really is such an a/b. */
function checkValueSum(id, value) {
  const p = problemsById.get(id);
  const want = Number(p.answer);
  for (let d = 1; d <= 10000; d++) {
    const n = Math.round(value * d);
    if (Math.abs(n / d - value) > 1e-9) continue;
    const [rn, rd] = reduce(n, d);
    if (rn + rd === want) return true;
    break; // exact representation found but it does not match the answer
  }
  errors.push(`${id}: computed ${value} is not a fraction a/b with a+b == ${p.answer}`);
  return false;
}

/* ------------------------------------------------------------------ loading */

let raw;
try {
  raw = readFileSync(DATA, "utf8");
} catch (e) {
  console.error(`FAIL: cannot read ${DATA}\n${e.message}`);
  process.exit(1);
}
let problems;
try {
  problems = JSON.parse(raw);
} catch (e) {
  console.error(`FAIL: invalid JSON in ${DATA}\n${e.message}`);
  process.exit(1);
}

const problemsById = new Map(problems.map((p) => [p.id, p]));

/* --------------------------------------------------------- schema validation */

const TYPES = new Set(["ACADEMICS", "OLYMPIAD"]);
const TOPICS = new Set(["INEQUALITY", "PROBABILITY"]);
const CATEGORIES = new Set(["PRIMARY", "JUNIOR", "SECONDARY", "HIGHER_SECONDARY"]);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD", "OLYMPIAD"]);
const LETTER = { EASY: "e", MEDIUM: "m", HARD: "h", OLYMPIAD: "o" };
const TOPIC_PREFIX = { INEQUALITY: "in", PROBABILITY: "pr" };
const ANSWER_RE = /^-?\d+(\.\d+)?(\/-?\d+)?$/;
const ID_RE = /^(in|pr)-(e|m|h|o)-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FIELDS = [
  "id", "slug", "type", "topic", "category", "difficulty",
  "title", "statement", "answer", "solution", "source"
];

function schemaError(msg) {
  errors.push(`schema: ${msg}`);
}

if (!Array.isArray(problems)) schemaError("root must be an array");
else if (problems.length !== 48) schemaError(`expected 48 problems, got ${problems.length}`);

const seenIds = new Set();
const seenSlugs = new Set();
const tally = new Map();

problems.forEach((p, i) => {
  const label = p && p.id ? p.id : `index ${i}`;
  if (typeof p !== "object" || p === null) return schemaError(`${label}: not an object`);
  for (const f of FIELDS) {
    if (!(f in p)) schemaError(`${label}: missing field "${f}"`);
  }
  if (typeof p.title === "object" && p.title !== null) {
    for (const f of ["en", "bn"]) {
      if (typeof p.title?.[f] !== "string" || !p.title[f].trim())
        schemaError(`${label}: title.${f} must be a non-empty string`);
      if (typeof p.statement?.[f] !== "string" || !p.statement[f].trim())
        schemaError(`${label}: statement.${f} must be a non-empty string`);
      if (typeof p.solution?.[f] !== "string" || !p.solution[f].trim())
        schemaError(`${label}: solution.${f} must be a non-empty string`);
      if (f === "bn" && typeof p.statement?.[f] === "string" && p.statement[f].endsWith("."))
        schemaError(`${label}: statement.${f} must not end with a Latin period (use । or ?)`);
    }
  }
  if (!TYPES.has(p.type)) schemaError(`${label}: bad type "${p.type}"`);
  if (!TOPICS.has(p.topic)) schemaError(`${label}: bad topic "${p.topic}"`);
  if (!CATEGORIES.has(p.category)) schemaError(`${label}: bad category "${p.category}"`);
  if (!DIFFICULTIES.has(p.difficulty)) schemaError(`${label}: bad difficulty "${p.difficulty}"`);
  if (typeof p.answer !== "string" || !ANSWER_RE.test(p.answer))
    schemaError(`${label}: bad answer "${p.answer}"`);
  if (typeof p.source !== "string" || !p.source.trim()) schemaError(`${label}: bad source`);
  if (typeof p.slug !== "string" || !SLUG_RE.test(p.slug)) schemaError(`${label}: bad slug "${p.slug}"`);
  if (typeof p.id !== "string" || !ID_RE.test(p.id)) schemaError(`${label}: bad id "${p.id}"`);

  if (typeof p.id === "string" && ID_RE.test(p.id)) {
    const [, prefix, letter, num] = p.id.match(ID_RE);
    if (TOPIC_PREFIX[p.topic] !== prefix) schemaError(`${label}: id prefix does not match topic ${p.topic}`);
    if (LETTER[p.difficulty] !== letter) schemaError(`${label}: id letter does not match difficulty ${p.difficulty}`);
    if (!/^in-[emho]-0[1-6]$/.test(p.id) && !/^pr-[emho]-0[1-6]$/.test(p.id))
      schemaError(`${label}: id index out of the expected 01-06 range`);
  }
  if (seenIds.has(p.id)) schemaError(`duplicate id ${p.id}`);
  seenIds.add(p.id);
  if (seenSlugs.has(p.slug)) schemaError(`duplicate slug ${p.slug}`);
  seenSlugs.add(p.slug);

  const key = `${p.topic}/${p.difficulty}`;
  tally.set(key, (tally.get(key) || 0) + 1);
});

for (const topic of TOPICS) {
  for (const diff of DIFFICULTIES) {
    const n = tally.get(`${topic}/${diff}`) || 0;
    if (n !== 6) schemaError(`expected 6 problems for ${topic}/${diff}, found ${n}`);
  }
}

/* ------------------------------------------------- independent recomputation */

const computations = new Map(); // id -> () => boolean
const reg = (id, fn) => computations.set(id, fn);

const popcount = (n) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};
const isSquare = (n) => Number.isInteger(Math.sqrt(n)) && Math.sqrt(n) ** 2 === n;

/* --- PROBABILITY: favourable / total, reduced, then numerator + denominator --- */

// two dice sum to 10
reg("pr-e-01", () => {
  let c = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === 10) c++;
  return checkSum("pr-e-01", c, 36);
});
// exactly two heads in three coins
reg("pr-e-02", () => {
  let c = 0;
  for (let s = 0; s < 8; s++) if (popcount(s) === 2) c++;
  return checkSum("pr-e-02", c, 8);
});
// one card from 52 is a face card (J,Q,K)
reg("pr-e-03", () => {
  let c = 0;
  for (let i = 0; i < 52; i++) if (i % 13 >= 10) c++; // ranks 10,11,12 = J,Q,K
  return checkSum("pr-e-03", c, 52);
});
// two-digit number divisible by 5
reg("pr-e-04", () => {
  let c = 0;
  for (let n = 10; n <= 99; n++) if (n % 5 === 0) c++;
  return checkSum("pr-e-04", c, 90);
});
// product of two dice is even
reg("pr-e-05", () => {
  let c = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if ((a * b) % 2 === 0) c++;
  return checkSum("pr-e-05", c, 36);
});
// multiple of 3 chosen from 1..20
reg("pr-e-06", () => {
  let c = 0;
  for (let n = 1; n <= 20; n++) if (n % 3 === 0) c++;
  return checkSum("pr-e-06", c, 20);
});
// product of two dice is a perfect square
reg("pr-m-01", () => {
  let c = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (isSquare(a * b)) c++;
  return checkSum("pr-m-01", c, 36);
});
// two aces among two cards drawn without replacement
reg("pr-m-02", () => {
  let c = 0, total = 0;
  for (let i = 0; i < 52; i++)
    for (let j = i + 1; j < 52; j++) {
      total++;
      if (i % 13 === 0 && j % 13 === 0) c++;
    }
  return checkSum("pr-m-02", c, total);
});
// three-digit number divisible by 8
reg("pr-m-03", () => {
  let c = 0;
  for (let n = 100; n <= 999; n++) if (n % 8 === 0) c++;
  return checkSum("pr-m-03", c, 900);
});
// at least three heads in four coins
reg("pr-m-04", () => {
  let c = 0;
  for (let s = 0; s < 16; s++) if (popcount(s) >= 3) c++;
  return checkSum("pr-m-04", c, 16);
});
// conditional: sum is 8 | at least one die shows 3
reg("pr-m-05", () => {
  let total = 0, fav = 0;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      if (a + b === 8) {
        total++;
        if (a === 3 || b === 3) fav++;
      }
  return checkSum("pr-m-05", fav, total);
});
// subset of {1..6} contains 1 and has even size
reg("pr-m-06", () => {
  let c = 0;
  for (let s = 0; s < 64; s++) if ((s & 1) === 1 && popcount(s) % 2 === 0) c++;
  return checkSum("pr-m-06", c, 64);
});
// three cards, all one suit
reg("pr-h-01", () => {
  let c = 0, total = 0;
  for (let i = 0; i < 52; i++)
    for (let j = i + 1; j < 52; j++)
      for (let k = j + 1; k < 52; k++) {
        total++;
        if (Math.floor(i / 13) === Math.floor(j / 13) && Math.floor(j / 13) === Math.floor(k / 13)) c++;
      }
  return checkSum("pr-h-01", c, total);
});
// four-digit PIN with non-decreasing digits
reg("pr-h-02", () => {
  let c = 0;
  for (let n = 0; n < 10000; n++) {
    const d = [Math.floor(n / 1000) % 10, Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
    if (d[0] <= d[1] && d[1] <= d[2] && d[2] <= d[3]) c++;
  }
  return checkSum("pr-h-02", c, 10000);
});
// conditional: sum >= 10 | at least one die shows 6
reg("pr-h-03", () => {
  let total = 0, fav = 0;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      if (a === 6 || b === 6) {
        total++;
        if (a + b >= 10) fav++;
      }
  return checkSum("pr-h-03", fav, total);
});
// first head appears within the first four tosses (enumerate the 16 prefixes)
reg("pr-h-04", () => {
  let fav = 0;
  for (let s = 0; s < 16; s++) if (popcount(s) >= 1) fav++; // first head at toss <= 4
  return checkSum("pr-h-04", fav, 16);
});
// expectation of the larger die, as a reduced fraction
reg("pr-h-05", () => {
  let sum = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) sum += Math.max(a, b);
  return checkSum("pr-h-05", sum, 36);
});
// m*n even, m,n uniform in 1..2026
reg("pr-h-06", () => {
  let c = 0;
  const N = 2026;
  for (let m = 1; m <= N; m++)
    for (let n = 1; n <= N; n++) if ((m * n) % 2 === 0) c++;
  return checkSum("pr-h-06", c, N * N);
});
// derangements of 6 elements
reg("pr-o-01", () => {
  const perm = [0, 1, 2, 3, 4, 5];
  let total = 0, der = 0;
  const permute = (k) => {
    if (k === perm.length) {
      total++;
      if (perm.every((v, i) => v !== i)) der++;
      return;
    }
    for (let i = k; i < perm.length; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      permute(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  };
  permute(0);
  return checkSum("pr-o-01", der, total);
});
// A subset of B for random subsets of {1..5}
reg("pr-o-02", () => {
  let c = 0, total = 0;
  for (let a = 0; a < 32; a++)
    for (let b = 0; b < 32; b++) {
      total++;
      if ((a & ~b) === 0) c++;
    }
  return checkSum("pr-o-02", c, total);
});
// poker full house among all 5-card hands
reg("pr-o-03", () => {
  let c = 0, total = 0;
  for (let i = 0; i < 52; i++)
    for (let j = i + 1; j < 52; j++)
      for (let k = j + 1; k < 52; k++)
        for (let l = k + 1; l < 52; l++)
          for (let m = l + 1; m < 52; m++) {
            total++;
            const cnt = new Array(13).fill(0);
            for (const x of [i, j, k, l, m]) cnt[x % 13]++;
            cnt.sort((p, q) => q - p);
            if (cnt[0] === 3 && cnt[1] === 2) c++;
          }
  return checkSum("pr-o-03", c, total);
});
// lattice point with x + y <= 10 in the 11x11 grid
reg("pr-o-04", () => {
  let c = 0, total = 0;
  for (let x = 0; x <= 10; x++)
    for (let y = 0; y <= 10; y++) {
      total++;
      if (x + y <= 10) c++;
    }
  return checkSum("pr-o-04", c, total);
});
// four +/-1 steps return to 0
reg("pr-o-05", () => {
  let c = 0;
  for (let s = 0; s < 16; s++) if (2 * popcount(s) - 4 === 0) c++;
  return checkSum("pr-o-05", c, 16);
});
// three-digit number with strictly increasing digits
reg("pr-o-06", () => {
  let c = 0;
  for (let n = 100; n <= 999; n++) {
    const a = Math.floor(n / 100), b = Math.floor(n / 10) % 10, d = n % 10;
    if (a < b && b < d) c++;
  }
  return checkSum("pr-o-06", c, 900);
});

/* --- INEQUALITY: grid search over the reals / exhaustive integer search --- */

/** Scan x = from, from+step, ... on a uniform grid, f(x) -> best value. */
function scan(from, to, step, f, mode = "min") {
  const n = Math.round((to - from) / step);
  let best = mode === "min" ? Infinity : -Infinity;
  for (let i = 0; i <= n; i++) {
    const x = from + i * step;
    const v = f(x);
    if (mode === "min" ? v < best : v > best) best = v;
  }
  return best;
}

// min x^2 + y^2 with x + y = 10 (x = grid, y = 10 - x)
reg("in-e-01", () => checkValue("in-e-01", scan(0, 10, 0.001, (x) => x * x + (10 - x) * (10 - x))));
// min x + 1/x for x > 0
reg("in-e-02", () => checkValue("in-e-02", scan(0.001, 500, 0.001, (x) => x + 1 / x)));
// max ab over positive integers with a + b = 12
reg("in-e-03", () => {
  let best = -Infinity;
  for (let a = 1; a <= 11; a++) best = Math.max(best, a * (12 - a));
  return checkValue("in-e-03", best);
});
// min x^2 - 6x + 11
reg("in-e-04", () => checkValue("in-e-04", scan(-10, 20, 0.001, (x) => x * x - 6 * x + 11)));
// min |x - 3| + |x + 5|
reg("in-e-05", () =>
  checkValue("in-e-05", scan(-20, 20, 0.001, (x) => Math.abs(x - 3) + Math.abs(x + 5))));
// max 4x - x^2
reg("in-e-06", () => checkValue("in-e-06", scan(-10, 10, 0.001, (x) => 4 * x - x * x, "max")));
// min 1/x + 1/y with x + y = 20
reg("in-m-01", () => checkValue("in-m-01", scan(0.001, 19.999, 0.001, (x) => 1 / x + 1 / (20 - x))));
// max xy with x + 2y = 12
reg("in-m-02", () =>
  checkValue("in-m-02", scan(0.001, 5.999, 0.001, (y) => (12 - 2 * y) * y, "max")));
// min x^2 + y^2 + z^2 with x + y + z = 12 (two free grid variables)
reg("in-m-03", () => {
  let best = Infinity;
  for (let xi = 1; xi <= 1199; xi++) {
    const x = xi * 0.01;
    for (let yi = 1; yi <= 1199 - xi; yi++) {
      const y = yi * 0.01;
      const z = 12 - x - y;
      const v = x * x + y * y + z * z;
      if (v < best) best = v;
    }
  }
  return checkValue("in-m-03", best);
});
// max a^2 + b^2 over positive integers with a + b = 20
reg("in-m-04", () => {
  let best = -Infinity;
  for (let a = 1; a <= 19; a++) best = Math.max(best, a * a + (20 - a) * (20 - a));
  return checkValue("in-m-04", best);
});
// max |2x - 6| + |x - 10| on 0 <= x <= 10
reg("in-m-05", () =>
  checkValue("in-m-05", scan(0, 10, 0.001, (x) => Math.abs(2 * x - 6) + Math.abs(x - 10), "max")));
// max 2a + 3b on the circle a^2 + b^2 = 13 (angular sweep)
reg("in-m-06", () => {
  const r = Math.sqrt(13);
  let best = -Infinity;
  for (let i = 0; i < 628319; i++) {
    const t = i * 1e-5;
    const v = 2 * r * Math.cos(t) + 3 * r * Math.sin(t);
    if (v > best) best = v;
  }
  return checkValue("in-m-06", best);
});
// min a/(b+c) + b/(a+c) + c/(a+b); the problem asks for p+q of that minimum p/q
reg("in-h-01", () => {
  let best = Infinity;
  for (let a = 1; a <= 40; a++)
    for (let b = 1; b <= 40; b++)
      for (let c = 1; c <= 40; c++) {
        const v = a / (b + c) + b / (a + c) + c / (a + b);
        if (v < best) best = v;
      }
  return checkValueSum("in-h-01", best);
});
// min x + y + z with xyz = 27 (two free grid variables)
reg("in-h-02", () => {
  let best = Infinity;
  for (let xi = 1; xi <= 3000; xi++) {
    const x = xi * 0.01;
    for (let yi = 1; yi <= 3000; yi++) {
      const y = yi * 0.01;
      const v = x + y + 27 / (x * y);
      if (v < best) best = v;
    }
  }
  return checkValue("in-h-02", best);
});
// max x + y with x^2 + y^2 = 200 (angular sweep)
reg("in-h-03", () => {
  const r = Math.sqrt(200);
  let best = -Infinity;
  for (let i = 0; i < 628319; i++) {
    const t = i * 1e-5;
    const v = r * Math.cos(t) + r * Math.sin(t);
    if (v > best) best = v;
  }
  return checkValue("in-h-03", best);
});
// max abc over positive integers with a + b + c = 15
reg("in-h-04", () => {
  let best = -Infinity;
  for (let a = 1; a <= 13; a++)
    for (let b = 1; b <= 14 - a; b++) {
      const c = 15 - a - b;
      if (c >= 1) best = Math.max(best, a * b * c);
    }
  return checkValue("in-h-04", best);
});
// min 1/x + 1/y + 1/z with x + y + z = 12
reg("in-h-05", () => {
  let best = Infinity;
  for (let xi = 1; xi <= 1199; xi++) {
    const x = xi * 0.01;
    for (let yi = 1; yi <= 1199 - xi; yi++) {
      const y = yi * 0.01;
      const z = 12 - x - y;
      const v = 1 / x + 1 / y + 1 / z;
      if (v < best) best = v;
    }
  }
  return checkValue("in-h-05", best);
});
// min x + y with 1/x + 1/y = 6 (parameter a = 1/x sweeps (0,6))
reg("in-h-06", () =>
  checkValue("in-h-06", scan(0.001, 5.999, 0.001, (a) => 1 / a + 1 / (6 - a))));
// min x^2+y^2+z^2+xy+yz+zx with x + y + z = 9
reg("in-o-01", () => {
  let best = Infinity;
  for (let xi = 1; xi <= 899; xi++) {
    const x = xi * 0.01;
    for (let yi = 1; yi <= 899 - xi; yi++) {
      const y = yi * 0.01;
      const z = 9 - x - y;
      const v = x * x + y * y + z * z + x * y + y * z + z * x;
      if (v < best) best = v;
    }
  }
  return checkValue("in-o-01", best);
});
// min 9/x + 16/y with x + y = 7
reg("in-o-02", () => checkValue("in-o-02", scan(0.001, 6.999, 0.001, (x) => 9 / x + 16 / (7 - x))));
// min sum_{k=1}^{10} |x - k|
reg("in-o-03", () => {
  const pts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return checkValue(
    "in-o-03",
    scan(-2, 12, 0.001, (x) => pts.reduce((s, k) => s + Math.abs(x - k), 0))
  );
});
// min (x+y)(y+z)(z+x)/(xyz) over a positive grid
reg("in-o-04", () => {
  let best = Infinity;
  for (let xi = 1; xi <= 100; xi++) {
    const x = xi * 0.1;
    for (let yi = 1; yi <= 100; yi++) {
      const y = yi * 0.1;
      for (let zi = 1; zi <= 100; zi++) {
        const z = zi * 0.1;
        const v = ((x + y) * (y + z) * (z + x)) / (x * y * z);
        if (v < best) best = v;
      }
    }
  }
  return checkValue("in-o-04", best);
});
// max x*y^2*z^3 with x + y + z = 6
reg("in-o-05", () => {
  let best = -Infinity;
  for (let xi = 1; xi <= 599; xi++) {
    const x = xi * 0.01;
    for (let yi = 1; yi <= 599 - xi; yi++) {
      const y = yi * 0.01;
      const z = 6 - x - y;
      const v = x * y * y * z * z * z;
      if (v > best) best = v;
    }
  }
  return checkValue("in-o-05", best);
});
// max a^2*b over positive integers with a + b + c = 20
reg("in-o-06", () => {
  let best = -Infinity;
  for (let a = 1; a <= 18; a++)
    for (let b = 1; b <= 19 - a; b++) {
      const c = 20 - a - b;
      if (c >= 1) best = Math.max(best, a * a * b);
    }
  return checkValue("in-o-06", best);
});

/* ------------------------------------------------------------------ report */

const schemaErrors = errors.filter((e) => e.startsWith("schema:"));
const answerErrors = errors.filter((e) => !e.startsWith("schema:"));

// every problem must carry a recomputation
for (const p of problems) {
  if (p && p.id && !computations.has(p.id)) errors.push(`${p.id}: no independent recomputation defined`);
}

let checked = 0, passed = 0;
for (const [id, fn] of computations) {
  if (!problemsById.has(id)) {
    errors.push(`${id}: computation references an unknown problem id`);
    continue;
  }
  checked++;
  const before = errors.length;
  try {
    fn();
  } catch (e) {
    errors.push(`${id}: verifier threw ${e.stack.split("\n")[0]}`);
  }
  if (errors.length === before) passed++;
}

const totalChecked = computations.size;
const pct = problems.length ? Math.round((1000 * checked) / problems.length) / 10 : 0;

console.log("================================================================");
console.log(" verify-c.mjs  ::  src/data/problems-c.json");
console.log("================================================================");
console.log(` problems found      : ${problems.length}`);
console.log(` schema              : ${schemaErrors.length === 0 ? "PASS" : `FAIL (${schemaErrors.length} issue(s))`}`);
console.log(` recomputed by code  : ${checked}/${problems.length} (${pct}%)`);
console.log(` recomputation       : ${passed === checked && checked > 0 ? "PASS" : `FAIL (${checked - passed} wrong)`}`);
if (errors.length) {
  console.log("----------------------------------------------------------------");
  for (const e of errors) console.log(`  FAIL  ${e}`);
}
console.log("================================================================");
console.log(errors.length === 0 ? " RESULT: PASS  (all checks green)" : ` RESULT: FAIL  (${errors.length} error(s))`);
console.log("================================================================");
process.exit(errors.length === 0 ? 0 : 1);


