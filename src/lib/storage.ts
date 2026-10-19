import type { PracticeTest, ScheduledTest } from "./types";

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
const NAME_KEY = `${NS}display-name`;
const ADMIN_KEY = `${NS}admin-token`;
const SCHEDULED_KEY = `${NS}scheduled`;
const DRAFT_KEY = `${NS}drafts`;

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

/* ------------------------------------------------------------------ */
/* Leaderboard display name                                            */
/* ------------------------------------------------------------------ */

/** Display name used for scheduled-test attempts and leaderboard rows. */
export function readDisplayName(): string {
  return safeGet(NAME_KEY) ?? "";
}

export function writeDisplayName(name: string): void {
  safeSet(NAME_KEY, name.slice(0, 40));
}

/* ------------------------------------------------------------------ */
/* Admin session                                                       */
/* ------------------------------------------------------------------ */

interface AdminSession {
  token: string;
  expiresAt: number;
}

/** Read a still-valid admin token (expired sessions are cleared on read). */
export function readAdminToken(): string | null {
  const raw = safeGet(ADMIN_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AdminSession;
    if (!session.token || typeof session.expiresAt !== "number") return null;
    if (session.expiresAt <= Date.now()) {
      safeSet(ADMIN_KEY, "");
      return null;
    }
    return session.token;
  } catch {
    return null;
  }
}

export function writeAdminToken(token: string, expiresAt: number): void {
  safeSet(ADMIN_KEY, JSON.stringify({ token, expiresAt } satisfies AdminSession));
}

export function clearAdminToken(): void {
  safeSet(ADMIN_KEY, "");
}

/* ------------------------------------------------------------------ */
/* Scheduled-test cache                                                */
/* ------------------------------------------------------------------ */

/** Last-known scheduled tests, so /tests renders instantly while fetching. */
export function readCachedScheduled(): ScheduledTest[] | null {
  try {
    const raw = safeGet(SCHEDULED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScheduledTest[]) : null;
  } catch {
    return null;
  }
}

export function writeCachedScheduled(tests: ScheduledTest[]): void {
  safeSet(SCHEDULED_KEY, JSON.stringify(tests.slice(0, 50)));
}

/* ------------------------------------------------------------------ */
/* In-flight scheduled attempts (drafts)                               */
/* ------------------------------------------------------------------ */

/**
 * Started-but-unsubmitted scheduled attempts, keyed by scheduled test id.
 * Kept out of the past-tests list so a closed tab never looks like a
 * finished paper — /tests rehydrates them into sessionStorage to resume.
 */
export function readDrafts(): Record<string, PracticeTest> {
  try {
    const raw = safeGet(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, PracticeTest>) : {};
  } catch {
    return {};
  }
}

export function writeDraft(draft: PracticeTest): void {
  if (!draft.scheduledTestId) return;
  const all = readDrafts();
  all[draft.scheduledTestId] = draft;
  safeSet(DRAFT_KEY, JSON.stringify(all));
}

export function clearDraft(scheduledTestId: string): void {
  const all = readDrafts();
  if (!(scheduledTestId in all)) return;
  delete all[scheduledTestId];
  safeSet(DRAFT_KEY, JSON.stringify(all));
}
