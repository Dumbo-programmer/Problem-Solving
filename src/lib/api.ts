import type {
  LeaderboardWindow,
  PeriodRow,
  PracticeTest,
  Problem,
  ScheduledTest,
  SessionUser,
  StandingsRow,
  TestFilters
} from "./types";
import { PROBLEMS } from "../data";
import { buildDemoEntries, buildScheduledSeeds } from "./scheduled";
import { markYou, overallLeaderboard, standings } from "./leaderboard";
import {
  clearAdminToken,
  clearSession,
  getClientId,
  readAdminToken,
  readCachedScheduled,
  readLocalTests,
  readSession,
  upsertLocalTest,
  writeAdminToken,
  writeCachedScheduled,
  writeDisplayName,
  writeLocalTests,
  writeSession
} from "./storage";

/**
 * Client for the Netlify Function that fronts Supabase.
 *
 * Every call degrades gracefully: if the function (or the database) is not
 * available we fall back to the bundled problem bank and localStorage, so the
 * learner never hits a dead end.
 */

/** Netlify serves the function under /.netlify/functions; `npm run dev:api`
 *  (and the smoke run) point this at a local server via VITE_API_BASE. */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "/.netlify/functions/api";

/** Thrown for non-2xx responses so callers can branch on the status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    /** Machine-readable code from the API body (`error` field), when present. */
    readonly code: string | null = null,
    message = `HTTP ${status}`
  ) {
    super(message);
  }
}

export type CloudState = "unknown" | "online" | "offline";

let cloudState: CloudState = "unknown";
const listeners = new Set<(s: CloudState) => void>();

export function getCloudState(): CloudState {
  return cloudState;
}

export function onCloudStateChange(fn: (s: CloudState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setCloudState(next: CloudState) {
  if (cloudState === next) return;
  cloudState = next;
  for (const fn of listeners) fn(next);
}

/** The signed-in learner's account id, or undefined when anonymous. */
export function currentAccountId(): string | undefined {
  return readSession()?.user.id;
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
    });
    if (!res.ok) {
      // Surface the API's error code (e.g. "username_taken") to callers.
      let code: string | null = null;
      try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body?.error === "string") code = body.error;
      } catch {
        /* non-JSON error body — status alone will have to do */
      }
      throw new HttpError(res.status, code);
    }
    const json = (await res.json()) as T;
    setCloudState("online");
    return json;
  } catch (err) {
    // A reachable server answering 4xx/5xx is still "online" — only real
    // network failures flip the badge to offline.
    if (!(err instanceof HttpError)) setCloudState("offline");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Normalise filter arrays for a query string (empty = "no restriction"). */
function qs(filters: Partial<TestFilters>): string {
  const p = new URLSearchParams();
  const add = (k: string, v: string[] | undefined) => {
    if (v && v.length) p.set(k, v.join(","));
  };
  add("type", filters.types);
  add("topic", filters.topics);
  add("category", filters.categories);
  add("difficulty", filters.difficulties);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Fetch the problem bank from Supabase, filtered. Falls back to the bundled
 * bank when the API is unavailable.
 */
export async function fetchProblems(filters: Partial<TestFilters> = {}): Promise<{
  problems: Problem[];
  source: "cloud" | "local";
}> {
  try {
    const data = await request<{ problems: Problem[] }>(`/problems${qs(filters)}`);
    if (Array.isArray(data.problems) && data.problems.length > 0) {
      return { problems: data.problems, source: "cloud" };
    }
    // An empty cloud result is legitimate but suspicious — prefer the bundle.
    return { problems: filterLocal(filters), source: "local" };
  } catch {
    return { problems: filterLocal(filters), source: "local" };
  }
}

function filterLocal(filters: Partial<TestFilters>): Problem[] {
  const any = (selected: string[] | undefined, value: string) =>
    !selected || selected.length === 0 || selected.includes(value);
  return PROBLEMS.filter(
    (p) =>
      any(filters.types, p.type) &&
      any(filters.topics, p.topic) &&
      any(filters.categories, p.category) &&
      any(filters.difficulties, p.difficulty)
  );
}

/** Persist a submitted test to Supabase, mirroring it locally regardless. */
export async function saveTest(test: PracticeTest): Promise<{ origin: "cloud" | "local" }> {
  // Stamp the attempt with the signed-in account so boards can rank it.
  const stamped: PracticeTest = { ...test, clientId: getClientId(), accountId: currentAccountId() };
  upsertLocalTest({ ...stamped, origin: "local" });
  try {
    await request("/tests", {
      method: "POST",
      body: JSON.stringify(stamped)
    });
    return { origin: "cloud" };
  } catch {
    return { origin: "local" };
  }
}

/**
 * Load past practice tests. Tries Supabase first, then merges with the local
 * mirror so nothing ever disappears when the network flakes.
 */
export async function fetchPastTests(): Promise<PracticeTest[]> {
  const local = readLocalTests();
  try {
    const data = await request<{ tests: PracticeTest[] }>(`/tests?clientId=${encodeURIComponent(getClientId())}`);
    if (!Array.isArray(data.tests)) return local;
    const merged = new Map<string, PracticeTest>();
    for (const t of local) merged.set(t.id, t);
    for (const t of data.tests) {
      const existing = merged.get(t.id);
      // Cloud copy wins unless it is older than a newer local submission.
      if (!existing || (existing.submittedAt ?? "") <= (t.submittedAt ?? "")) {
        merged.set(t.id, { ...t, origin: "cloud" });
      }
    }
    const list = [...merged.values()].sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
    writeLocalTests(list);
    return list;
  } catch {
    return local;
  }
}

export async function deletePastTest(id: string): Promise<void> {
  const remaining = readLocalTests().filter((t) => t.id !== id);
  writeLocalTests(remaining);
  try {
    await request(`/tests?id=${encodeURIComponent(id)}&clientId=${encodeURIComponent(getClientId())}`, {
      method: "DELETE"
    });
  } catch {
    /* local delete already applied */
  }
}

/* ------------------------------------------------------------------ */
/* Scheduled tests                                                     */
/* ------------------------------------------------------------------ */

/** This browser's seed papers (bundled) + any cached cloud papers. */
function localScheduled(): ScheduledTest[] {
  const seeds = buildScheduledSeeds(PROBLEMS, new Date());
  const seedIds = new Set(seeds.map((t) => t.id));
  const cached = readCachedScheduled() ?? [];
  const extra = cached.filter((t) => !seedIds.has(t.id) && phaseNotStale(t));
  return [...seeds, ...extra].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Keep cached papers only while their window still has meaning (not long past). */
function phaseNotStale(test: ScheduledTest): boolean {
  return Date.parse(test.endAt) > Date.now() - 90 * 24 * 60 * 60 * 1000;
}

/** Demo + own submissions known to this device, for offline board maths. */
function localEntries(tests: ScheduledTest[]): PracticeTest[] {
  const mine = readLocalTests().filter((t) => t.status === "SUBMITTED" && Boolean(t.scheduledTestId));
  return [...buildDemoEntries(tests), ...mine];
}

function countParticipants(tests: ScheduledTest[], entries: PracticeTest[]): ScheduledTest[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!e.scheduledTestId) continue;
    counts.set(e.scheduledTestId, (counts.get(e.scheduledTestId) ?? 0) + 1);
  }
  return tests.map((t) => ({
    ...t,
    participants: Math.max(t.participants ?? 0, counts.get(t.id) ?? 0)
  }));
}

/** Published weekly/monthly papers (cloud first, seeds as offline fallback). */
export async function fetchScheduledTests(): Promise<{
  tests: ScheduledTest[];
  source: "cloud" | "local";
}> {
  try {
    const data = await request<{ tests: ScheduledTest[] }>("/scheduled-tests");
    const tests = Array.isArray(data.tests) ? data.tests : [];
    writeCachedScheduled(tests);
    return { tests, source: "cloud" };
  } catch {
    const tests = localScheduled();
    return { tests: countParticipants(tests, localEntries(tests)), source: "local" };
  }
}

/* ------------------------------------------------------------------ */
/* Leaderboards                                                        */
/* ------------------------------------------------------------------ */

/** Per-test standings (contests page + results page). */
export async function fetchStandings(testId: string): Promise<{
  rows: StandingsRow[];
  source: "cloud" | "local";
}> {
  const accountId = currentAccountId();
  try {
    const data = await request<{ rows: StandingsRow[] }>(
      `/standings?testId=${encodeURIComponent(testId)}`,
      withSession()
    );
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return { rows: markYou(rows, getClientId(), accountId), source: "cloud" };
  } catch {
    const tests = localScheduled();
    const rows = standings(localEntries(tests), testId);
    return { rows: markYou(rows, getClientId(), accountId), source: "local" };
  }
}

/** The overall "problems solved" board (week / month / all time). */
export async function fetchLeaderboard(window: LeaderboardWindow): Promise<{
  rows: PeriodRow[];
  source: "cloud" | "local";
}> {
  const accountId = currentAccountId();
  try {
    const data = await request<{ rows: PeriodRow[] }>(
      `/leaderboard?window=${encodeURIComponent(window)}`,
      withSession()
    );
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return { rows, source: "cloud" };
  } catch {
    const tests = localScheduled();
    const rows = overallLeaderboard(localEntries(tests), { window, clientId: getClientId(), accountId });
    return { rows, source: "local" };
  }
}

/** Adds the learner bearer when signed in, so boards can mark the caller. */
function withSession(): RequestInit | undefined {
  const session = readSession();
  if (!session) return undefined;
  return { headers: { Authorization: `Bearer ${session.token}` } };
}

/* ------------------------------------------------------------------ */
/* Learner accounts                                                    */
/* ------------------------------------------------------------------ */

/** Authenticated learner call (adds the stored bearer; clears it on 401). */
async function authedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = readSession();
  if (!session) throw new HttpError(401, "no_session", "no session");
  try {
    return await request<T>(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session.token}` }
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) clearSession();
    throw err;
  }
}

/** Create an account; the session is stored and the display name adopted. */
export async function signup(input: {
  username: string;
  password: string;
  displayName: string;
  email: string;
  phone: string;
}): Promise<SessionUser> {
  const data = await request<{ token: string; expiresAt: number; user: SessionUser }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input)
  });
  writeSession({ token: data.token, expiresAt: data.expiresAt, user: data.user });
  writeDisplayName(data.user.displayName);
  return data.user;
}

/** Sign in to an existing account; the session is stored locally. */
export async function login(input: { username: string; password: string }): Promise<SessionUser> {
  const data = await request<{ token: string; expiresAt: number; user: SessionUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
  writeSession({ token: data.token, expiresAt: data.expiresAt, user: data.user });
  writeDisplayName(data.user.displayName);
  return data.user;
}

/**
 * Refresh the cached profile. When the API is unreachable the cached session
 * is trusted (so signing in once survives going offline); only a 401 — an
 * expired or revoked token — actually ends the session.
 */
export async function refreshSession(): Promise<SessionUser | null> {
  const session = readSession();
  if (!session) return null;
  try {
    const data = await authedRequest<{ user: SessionUser }>("/auth/me");
    writeSession({ ...session, user: data.user });
    return data.user;
  } catch (err) {
    if (err instanceof HttpError && (err.status === 401 || err.status === 404)) return null;
    return session.user;
  }
}

/** Rename the account (also updates the local session + display name). */
export async function updateDisplayName(displayName: string): Promise<SessionUser> {
  const data = await authedRequest<{ user: SessionUser }>("/auth/profile", {
    method: "PUT",
    body: JSON.stringify({ displayName })
  });
  const session = readSession();
  if (session) writeSession({ ...session, user: data.user });
  writeDisplayName(data.user.displayName);
  return data.user;
}

/** Forget the local session (the server needs no round-trip). */
export function logout(): void {
  clearSession();
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface AdminOverview {
  source: "postgres" | "file";
  problems: number;
  tests: number;
  submissions: number;
  learners: number;
  accounts: number;
}

export interface AdminSubmission {
  entryId: string;
  name: string;
  clientId: string;
  testId: string;
  testTitle: string;
  score: number;
  maxScore: number;
  pct: number;
  timeTakenSec: number;
  submittedAt: string;
}

/** Sign in with the ADMIN_ID / ADMIN_PASSWORD pair; the token is stored locally. */
export async function loginAdmin(id: string, password: string): Promise<number> {
  const data = await request<{ token: string; expiresAt: number }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ id, password })
  });
  writeAdminToken(data.token, data.expiresAt);
  return data.expiresAt;
}

export function logoutAdmin(): void {
  clearAdminToken();
}

/**
 * Whether the deployment still runs on the documented default admin
 * credentials. Booleans only — a configured secret is never sent to the
 * browser.
 */
export async function adminCredentialStatus(): Promise<{ id: boolean; password: boolean }> {
  const data = await request<{ id: boolean; password: boolean }>("/admin/credentials");
  return { id: data.id !== false, password: data.password !== false };
}

/** Authenticated call to an /admin/* route (clears the session on 401). */
export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readAdminToken();
  if (!token) throw new HttpError(401, "no_admin_session", "no admin session");
  try {
    return await request<T>(`/admin${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` }
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) clearAdminToken();
    throw err;
  }
}

export const adminOverview = () => adminFetch<AdminOverview>("/overview");

export const adminSubmissions = () => adminFetch<{ submissions: AdminSubmission[] }>("/submissions");

export const adminListTests = () => adminFetch<{ tests: ScheduledTest[] }>("/scheduled-tests");

export const adminSaveProblem = (problem: Problem) =>
  adminFetch<{ ok: boolean }>("/problems", { method: "POST", body: JSON.stringify({ problem }) });

export const adminDeleteProblem = (id: string) =>
  adminFetch<{ ok: boolean }>(`/problems?id=${encodeURIComponent(id)}`, { method: "DELETE" });

export const adminSaveTest = (test: ScheduledTest) =>
  adminFetch<{ ok: boolean }>("/scheduled-tests", { method: "POST", body: JSON.stringify({ test }) });

export const adminDeleteTest = (id: string) =>
  adminFetch<{ ok: boolean }>(`/scheduled-tests?id=${encodeURIComponent(id)}`, { method: "DELETE" });
