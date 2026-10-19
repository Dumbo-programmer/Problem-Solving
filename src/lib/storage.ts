import type { PracticeTest } from "./types";

/**
 * Thin localStorage wrapper + the anonymous client id.
 *
 * Everything the learner does is mirrored locally so the site keeps working
 * with JavaScript offline / before Supabase is configured. When the cloud API
 * is reachable it becomes the source of truth and the local copy acts as cache.
 */

const NS = "gonit-ishkul:";
const CLIENT_KEY = `${NS}client-id`;
const TESTS_KEY = `${NS}tests`;
const LANG_KEY = `${NS}lang`;
const THEME_KEY = `${NS}theme`;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — ignore, we still work in memory */
  }
}

/** Stable anonymous id for this browser, created on first use. */
export function getClientId(): string {
  let id = safeGet(CLIENT_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    safeSet(CLIENT_KEY, id);
  }
  return id;
}

export function readLocalTests(): PracticeTest[] {
  try {
    const raw = safeGet(TESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PracticeTest[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalTests(tests: PracticeTest[]): void {
  // Keep the most recent 200 so storage can't grow without bound.
  safeSet(TESTS_KEY, JSON.stringify(tests.slice(0, 200)));
}

export function upsertLocalTest(test: PracticeTest): PracticeTest[] {
  const all = readLocalTests();
  const idx = all.findIndex((t) => t.id === test.id);
  const next = idx >= 0 ? all.map((t, i) => (i === idx ? test : t)) : [test, ...all];
  writeLocalTests(next);
  return next;
}

export function readLang(): "en" | "bn" {
  const v = safeGet(LANG_KEY);
  return v === "en" || v === "bn" ? v : "bn";
}

export function writeLang(lang: "en" | "bn"): void {
  safeSet(LANG_KEY, lang);
}

export function readTheme(): "dark" | "light" {
  const v = safeGet(THEME_KEY);
  return v === "light" ? "light" : "dark";
}

export function writeTheme(theme: "dark" | "light"): void {
  safeSet(THEME_KEY, theme);
}

/** Generate a collision-resistant id for a new practice test. */
export function newTestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
