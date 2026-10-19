import type { PracticeTest, Problem, TestFilters } from "./types";
import { PROBLEMS } from "../data";
import {
  getClientId,
  readLocalTests,
  upsertLocalTest,
  writeLocalTests
} from "./storage";

/**
 * Client for the Netlify Function that fronts Supabase.
 *
 * Every call degrades gracefully: if the function (or the database) is not
 * available we fall back to the bundled problem bank and localStorage, so the
 * learner never hits a dead end.
 */

const BASE = "/.netlify/functions/api";

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

async function request<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as T;
    setCloudState("online");
    return json;
  } catch (err) {
    setCloudState("offline");
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
  const local = upsertLocalTest({ ...test, origin: "local" });
  void local;
  try {
    await request("/tests", {
      method: "POST",
      body: JSON.stringify({ ...test, clientId: getClientId() })
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
