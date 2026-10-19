/**
 * Problem bank — the heart of Gonit Ishkul Problem Solving.
 *
 * Every problem is auto-gradable (numeric answer), so a practice test can be
 * scored the instant it is submitted. Each entry is bilingual (Bangla + English).
 *
 * Taxonomy:
 *   Type       : OLYMPIAD | ACADEMICS
 *   Topic      : NUMBER_THEORY | ALGEBRA | GEOMETRY | COMBINATORICS | INEQUALITY | PROBABILITY
 *   Category   : PRIMARY | JUNIOR | SECONDARY | HIGHER_SECONDARY
 *   Difficulty : EASY | MEDIUM | HARD | OLYMPIAD
 */

export type ProblemType = "OLYMPIAD" | "ACADEMICS";
export type ProblemTopic =
  | "NUMBER_THEORY"
  | "ALGEBRA"
  | "GEOMETRY"
  | "COMBINATORICS"
  | "INEQUALITY"
  | "PROBABILITY";
export type ProblemCategory = "PRIMARY" | "JUNIOR" | "SECONDARY" | "HIGHER_SECONDARY";
export type ProblemDifficulty = "EASY" | "MEDIUM" | "HARD" | "OLYMPIAD";

/** Bangla + English — every learner-facing string is stored in both. */
export interface Localized {
  en: string;
  bn: string;
}

export interface Problem {
  id: string;
  slug: string;
  type: ProblemType;
  topic: ProblemTopic;
  category: ProblemCategory;
  difficulty: ProblemDifficulty;
  title: Localized;
  statement: Localized;
  /** Canonical answer. Numeric (integers, decimals or fractions such as "3/4"). */
  answer: string;
  solution: Localized;
  source: string;
}

/** Ordered vocabularies used by the UI filters and by the database seed. */
export const TOPICS: { key: ProblemTopic; en: string; bn: string; blurb: { en: string; bn: string } }[] = [
  {
    key: "NUMBER_THEORY",
    en: "Number Theory",
    bn: "সংখ্যাতত্ত্ব",
    blurb: {
      en: "Primes, divisibility, remainders and Diophantine puzzles.",
      bn: "মৌলিক সংখ্যা, ভাজকতা, ভাগশেষ ও ডায়োফ্যান্টাইন সমস্যা।"
    }
  },
  {
    key: "ALGEBRA",
    en: "Algebra",
    bn: "বীজগাণিতিক",
    blurb: {
      en: "Equations, identities, sequences and functional thinking.",
      bn: "সমীকরণ, সর্বসমিকা, ধারা ও ফাংশনভিত্তিক চিন্তা।"
    }
  },
  {
    key: "GEOMETRY",
    en: "Geometry",
    bn: "জ্যামিতিক",
    blurb: {
      en: "Triangles, circles, areas and beautiful configurations.",
      bn: "ত্রিভুজ, বৃত্ত, ক্ষেত্রফল ও সুন্দর কনফিগারেশন।"
    }
  },
  {
    key: "COMBINATORICS",
    en: "Combinatorics",
    bn: "যোজনবিদ্যা",
    blurb: {
      en: "Counting, arrangements, subsets and the pigeonhole idea.",
      bn: "গণনা, বিন্যাস, উপসমষ্টি ও কবুতরবাসির নীতি।"
    }
  },
  {
    key: "INEQUALITY",
    en: "Inequality",
    bn: "অসমতা",
    blurb: {
      en: "Bounds, AM–GM, Cauchy and extremal arguments.",
      bn: "সীমাবদ্ধতা, AM–GM, কসি ও চরম মানের যুক্তি।"
    }
  },
  {
    key: "PROBABILITY",
    en: "Probability",
    bn: "সম্ভাব্যতা",
    blurb: {
      en: "Counting-based probability, expectation and parity.",
      bn: "গণনাভিত্তিক সম্ভাব্যতা, প্রত্যাশা ও উত্তরোত্তরতা।"
    }
  }
];

export const CATEGORIES: { key: ProblemCategory; en: string; bn: string; grades: string }[] = [
  { key: "PRIMARY", en: "Primary", bn: "প্রাথমিক", grades: "Class 3–5" },
  { key: "JUNIOR", en: "Junior", bn: "জুনিয়র", grades: "Class 6–8" },
  { key: "SECONDARY", en: "Secondary", bn: "মাধ্যমিক", grades: "Class 9–10" },
  { key: "HIGHER_SECONDARY", en: "Higher Secondary", bn: "উচ্চ মাধ্যমিক", grades: "Class 11–12" }
];

export const DIFFICULTIES: { key: ProblemDifficulty; en: string; bn: string; rank: number }[] = [
  { key: "EASY", en: "Easy", bn: "সহজ", rank: 1 },
  { key: "MEDIUM", en: "Medium", bn: "মাঝারি", rank: 2 },
  { key: "HARD", en: "Hard", bn: "কঠিন", rank: 3 },
  { key: "OLYMPIAD", en: "Olympiad", bn: "অলিম্পিয়াড", rank: 4 }
];

export const TYPES: { key: ProblemType; en: string; bn: string }[] = [
  { key: "OLYMPIAD", en: "Olympiad", bn: "অলিম্পিয়াড" },
  { key: "ACADEMICS", en: "Academics", bn: "একাডেমিক" }
];
