/**
 * Netlify Function — the single API surface for Gonit Ishkul Problem Solving.
 *
 *   GET    /problems?type=&topic=&category=&difficulty=
 *   GET    /tests?clientId=
 *   POST   /tests
 *   DELETE /tests?id=&clientId=
 *   GET    /scheduled-tests                 published weekly/monthly papers
 *   GET    /standings?testId=               per-test standings
 *   GET    /leaderboard?window=week|month|all
 *   GET    /health
 *
 *   POST   /auth/signup                     { username, password, displayName }
 *   POST   /auth/login                      { username, password } → session
 *   GET    /auth/me                                           (auth)
 *   PUT    /auth/profile                      { displayName }  (auth)
 *
 *   POST   /admin/login                     { id, password } → bearer token
 *   GET    /admin/overview                  counts + data source        (auth)
 *   GET    /admin/submissions               contest submissions         (auth)
 *   GET    /admin/scheduled-tests           incl. unpublished           (auth)
 *   POST   /admin/problems                  upsert                      (auth)
 *   DELETE /admin/problems?id=                                            (auth)
 *   POST   /admin/scheduled-tests           upsert                      (auth)
 *   DELETE /admin/scheduled-tests?id=                                   (auth)
 *
 * Storage lives behind `lib/store.ts`: Supabase Postgres when a connection
 * opens, otherwise a JSON file on disk — so the API answers everywhere and the
 * front end only falls back to the bundled bank when it isn't reachable at all.
 * Leaderboard maths is shared with the browser via `src/lib/leaderboard.ts`.
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import type { PracticeTest, Problem, ScheduledTest } from "../../src/lib/types";
import { overallLeaderboard, pctOf, standings, timeTakenSec, nameOf } from "../../src/lib/leaderboard";
import { phaseOf } from "../../src/lib/scheduled";
import {
  bearer,
  checkCredentials,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  passwordOk,
  signSession,
  signToken,
  verifyPassword,
  verifySession,
  verifyToken
} from "./lib/auth";
import { readyStore, type Store, type StoredUser } from "./lib/store";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS"
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS
    },
    body: JSON.stringify(body)
  };
}

const ALLOWED = {
  type: new Set(["OLYMPIAD", "ACADEMICS"]),
  topic: new Set(["NUMBER_THEORY", "ALGEBRA", "GEOMETRY", "COMBINATORICS", "INEQUALITY", "PROBABILITY"]),
  category: new Set(["PRIMARY", "JUNIOR", "SECONDARY", "HIGHER_SECONDARY"]),
  difficulty: new Set(["EASY", "MEDIUM", "HARD", "OLYMPIAD"])
};

function parseList(value: string | undefined, allowed: Set<string>): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter((v) => allowed.has(v));
}

function bodyOf(event: HandlerEvent): Record<string, unknown> {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Participants per paper (distinct browsers with a submitted entry). */
function participantCounts(entries: PracticeTest[]): Map<string, number> {
  const seen = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.scheduledTestId) continue;
    const set = seen.get(e.scheduledTestId) ?? new Set<string>();
    set.add(e.clientId);
    seen.set(e.scheduledTestId, set);
  }
  return new Map([...seen].map(([id, set]) => [id, set.size]));
}

function withParticipants(tests: ScheduledTest[], counts: Map<string, number>): ScheduledTest[] {
  return tests.map((t) => ({ ...t, participants: counts.get(t.id) ?? 0 }));
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);

function localized(value: unknown): { bn: string; en: string } {
  const o = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return { bn: str(o.bn), en: str(o.en) };
}

/* ------------------------------------------------------------------ */
/* Learner routes                                                      */
/* ------------------------------------------------------------------ */

async function handleProblems(params: Record<string, string | undefined>) {
  const store = await readyStore();
  const problems = await store.listProblems({
    types: parseList(params.type, ALLOWED.type),
    topics: parseList(params.topic, ALLOWED.topic),
    categories: parseList(params.category, ALLOWED.category),
    difficulties: parseList(params.difficulty, ALLOWED.difficulty)
  });
  return json(200, { problems, count: problems.length, db: store.label, store: store.detail });
}

async function handleListTests(params: Record<string, string | undefined>) {
  const clientId = params.clientId;
  if (!clientId) return json(400, { error: "client_id_required" });
  const store = await readyStore();
  const tests = await store.listTests(clientId);
  return json(200, { tests });
}

async function handleSaveTest(event: HandlerEvent, body: Record<string, unknown>) {
  const id = str(body.id);
  const clientId = str(body.clientId);
  if (!id || !clientId) return json(400, { error: "id_and_client_id_required" });

  // The account link comes from the session, never the body — a learner must
  // not be able to post an attempt under someone else's account.
  const owner = await sessionUser(event);

  const store = await readyStore();
  const test: PracticeTest = {
    id,
    clientId,
    title: str(body.title, "Practice test"),
    filters: (body.filters as PracticeTest["filters"]) ?? { types: [], topics: [], categories: [], difficulties: [] },
    problemIds: Array.isArray(body.problemIds) ? (body.problemIds as string[]) : [],
    durationMin: Math.max(1, Math.min(240, Math.round(num(body.durationMin, 20)))),
    status: body.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
    answers: Array.isArray(body.answers) ? (body.answers as PracticeTest["answers"]) : [],
    score: Math.round(num(body.score)),
    maxScore: Math.round(num(body.maxScore)),
    correctCount: Math.round(num(body.correctCount)),
    startedAt: str(body.startedAt) || new Date().toISOString(),
    submittedAt: typeof body.submittedAt === "string" ? body.submittedAt : undefined,
    timedOut: bool(body.timedOut),
    origin: "cloud",
    scheduledTestId: str(body.scheduledTestId) || undefined,
    displayName: (owner?.displayName ?? str(body.displayName)).slice(0, 40) || undefined,
    accountId: owner?.id
  };
  await store.saveTest(test);
  return json(200, { ok: true, id });
}

async function handleDeleteTest(params: Record<string, string | undefined>) {
  const id = str(params.id);
  const clientId = str(params.clientId);
  if (!id || !clientId) return json(400, { error: "id_and_client_id_required" });
  const store = await readyStore();
  await store.deleteTest(id, clientId);
  return json(200, { ok: true });
}

/* ------------------------------------------------------------------ */
/* Learner accounts (sign up / sign in)                                */
/* ------------------------------------------------------------------ */

const MAX_NAME = 40;

/** Public shape of an account — the password hash never leaves the server. */
function userShape(u: StoredUser) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    phone: u.phone,
    createdAt: u.createdAt
  };
}

/** Resolves the bearer session to a user, or null when absent/expired. */
async function sessionUser(event: HandlerEvent): Promise<StoredUser | null> {
  const sub = verifySession(bearer(event.headers?.authorization ?? event.headers?.Authorization));
  if (!sub) return null;
  return (await readyStore()).findUserById(sub);
}

/** Burns the same CPU as a real verify so unknown usernames don't reply faster. */
let timingPad: string | null = null;
function dummyVerify(password: string): void {
  if (timingPad === null) timingPad = hashPassword("gonit-ishkul-timing-pad");
  verifyPassword(password, timingPad);
}

function sessionResponse(user: StoredUser) {
  const { token, expiresAt } = signSession(user.id);
  return json(200, { token, expiresAt, user: userShape(user) });
}

async function handleSignup(body: Record<string, unknown>) {
  const username = normalizeUsername(body.username);
  const displayName = str(body.displayName).replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  if (!username) return json(400, { error: "invalid_username" });
  if (!passwordOk(body.password)) return json(400, { error: "invalid_password" });
  if (!displayName) return json(400, { error: "display_name_required" });
  if (!email) return json(400, { error: "invalid_email" });
  if (!phone) return json(400, { error: "invalid_phone" });

  const store = await readyStore();
  // Email must be unique too — a friendly check up front, then the DB index.
  if (await store.findUserByEmail(email)) return json(409, { error: "email_taken" });

  const user: StoredUser = {
    id: randomUUID(),
    username,
    displayName,
    email,
    phone,
    passwordHash: hashPassword(body.password as string),
    createdAt: new Date().toISOString()
  };
  // `createUser` is the race-free check: false means someone took it first.
  const created = await store.createUser(user);
  if (!created) return json(409, { error: "username_taken" });
  return sessionResponse(user);
}

async function handleLogin(body: Record<string, unknown>) {
  const username = normalizeUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  const store = await readyStore();
  const user = username ? await store.findUserByUsername(username) : null;
  if (!user || !password) {
    if (password) dummyVerify(password);
    return json(401, { error: "bad_credentials" });
  }
  if (!verifyPassword(password, user.passwordHash)) return json(401, { error: "bad_credentials" });
  return sessionResponse(user);
}

async function handleMe(event: HandlerEvent) {
  const user = await sessionUser(event);
  if (!user) return json(401, { error: "unauthorized" });
  return json(200, { user: userShape(user) });
}

async function handleProfile(event: HandlerEvent, body: Record<string, unknown>) {
  const user = await sessionUser(event);
  if (!user) return json(401, { error: "unauthorized" });
  const displayName = str(body.displayName).replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  if (!displayName) return json(400, { error: "display_name_required" });
  const store = await readyStore();
  await store.setUserDisplayName(user.id, displayName);
  return json(200, { user: userShape({ ...user, displayName }) });
}

/* ------------------------------------------------------------------ */
/* Scheduled tests + leaderboards                                      */
/* ------------------------------------------------------------------ */

async function handleScheduledTests() {
  const store = await readyStore();
  const [tests, entries] = await Promise.all([store.listScheduled(false), store.listEntries()]);
  return json(200, { tests: withParticipants(tests, participantCounts(entries)) });
}

async function handleStandings(event: HandlerEvent, params: Record<string, string | undefined>) {
  const testId = str(params.testId);
  if (!testId) return json(400, { error: "test_id_required" });
  const store = await readyStore();
  const [entries, owner] = await Promise.all([store.listEntries(), sessionUser(event)]);
  const rows = standings(entries, testId)
    .map((r) => (owner && r.accountId === owner.id ? { ...r, isYou: true } : r))
    .slice(0, 500);
  return json(200, { rows, testId });
}

async function handleLeaderboard(event: HandlerEvent, params: Record<string, string | undefined>) {
  const window = str(params.window, "all");
  if (window !== "week" && window !== "month" && window !== "all") {
    return json(400, { error: "bad_window" });
  }
  const store = await readyStore();
  const [entries, owner] = await Promise.all([store.listEntries(), sessionUser(event)]);
  const rows = overallLeaderboard(entries, { window, accountId: owner?.id }).slice(0, 200);
  return json(200, { rows, window });
}

/* ------------------------------------------------------------------ */
/* Admin routes                                                        */
/* ------------------------------------------------------------------ */

async function adminGate(event: HandlerEvent): Promise<Store | null> {
  const token = bearer(event.headers?.authorization ?? event.headers?.Authorization);
  if (!verifyToken(token)) return null;
  return readyStore();
}

async function handleAdminLogin(body: Record<string, unknown>) {
  const id = str(body.id);
  const password = str(body.password);
  if (!checkCredentials(id, password)) {
    return json(401, { error: "bad_credentials" });
  }
  const { token, expiresAt } = signToken();
  return json(200, { token, expiresAt });
}

async function handleAdminOverview(store: Store) {
  const [counts, tests] = await Promise.all([store.overview(), store.listScheduled(true)]);
  return json(200, {
    source: store.label,
    detail: store.detail,
    ...counts,
    live: tests.filter((t) => phaseOf(t) === "live").length
  });
}

async function handleAdminSubmissions(store: Store) {
  const [tests, entries] = await Promise.all([store.listScheduled(true), store.listEntries()]);
  const titleById = new Map(tests.map((t) => [t.id, t.title.en || t.title.bn]));
  const submissions = entries
    .slice()
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
    .slice(0, 500)
    .map((e) => ({
      entryId: e.id,
      name: nameOf(e),
      clientId: e.clientId,
      testId: e.scheduledTestId ?? "",
      testTitle: titleById.get(e.scheduledTestId ?? "") ?? e.title,
      score: e.score,
      maxScore: e.maxScore,
      pct: pctOf(e),
      timeTakenSec: timeTakenSec(e),
      submittedAt: e.submittedAt ?? ""
    }));
  return json(200, { submissions });
}

async function handleAdminListScheduled(store: Store) {
  const [tests, entries] = await Promise.all([store.listScheduled(true), store.listEntries()]);
  return json(200, { tests: withParticipants(tests, participantCounts(entries)) });
}

function problemFromBody(body: Record<string, unknown>): Problem | null {
  const raw = (typeof body.problem === "object" && body.problem !== null ? body.problem : {}) as Record<
    string,
    unknown
  >;
  const id = str(raw.id);
  if (!id) return null;
  if (!ALLOWED.type.has(str(raw.type))) return null;
  if (!ALLOWED.topic.has(str(raw.topic))) return null;
  if (!ALLOWED.category.has(str(raw.category))) return null;
  if (!ALLOWED.difficulty.has(str(raw.difficulty))) return null;

  const title = localized(raw.title);
  const statement = localized(raw.statement);
  const solution = localized(raw.solution);
  if (!title.bn || !title.en || !statement.bn || !statement.en || !str(raw.answer)) return null;

  return {
    id,
    slug: str(raw.slug) || id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    type: str(raw.type) as Problem["type"],
    topic: str(raw.topic) as Problem["topic"],
    category: str(raw.category) as Problem["category"],
    difficulty: str(raw.difficulty) as Problem["difficulty"],
    title,
    statement,
    answer: str(raw.answer),
    solution,
    source: str(raw.source)
  };
}

async function handleAdminSaveProblem(store: Store, body: Record<string, unknown>) {
  const problem = problemFromBody(body);
  if (!problem) return json(400, { error: "invalid_problem" });
  await store.saveProblem(problem);
  return json(200, { ok: true, id: problem.id });
}

async function handleAdminDeleteProblem(store: Store, params: Record<string, string | undefined>) {
  const id = str(params.id);
  if (!id) return json(400, { error: "id_required" });
  await store.deleteProblem(id);
  return json(200, { ok: true, id });
}

function testFromBody(body: Record<string, unknown>): ScheduledTest | null {
  const raw = (typeof body.test === "object" && body.test !== null ? body.test : {}) as Record<string, unknown>;
  const id = str(raw.id);
  const startAt = str(raw.startAt);
  const endAt = str(raw.endAt);
  const problemIds = Array.isArray(raw.problemIds) ? (raw.problemIds as string[]).filter((v) => typeof v === "string") : [];
  const title = localized(raw.title);
  const description = localized(raw.description);

  if (!id || !title.en || !title.bn) return null;
  if (!Number.isFinite(Date.parse(startAt)) || !Number.isFinite(Date.parse(endAt))) return null;
  if (Date.parse(endAt) <= Date.parse(startAt)) return null;
  if (problemIds.length === 0) return null;

  const kind = str(raw.kind, "CUSTOM");
  return {
    id,
    kind: (kind === "WEEKLY" || kind === "MONTHLY" ? kind : "CUSTOM") as ScheduledTest["kind"],
    title,
    description,
    startAt,
    endAt,
    durationMin: Math.max(1, Math.min(24 * 60, Math.round(num(raw.durationMin, 45)))),
    problemIds,
    published: bool(raw.published, true)
  };
}

async function handleAdminSaveScheduled(store: Store, body: Record<string, unknown>) {
  const test = testFromBody(body);
  if (!test) return json(400, { error: "invalid_test" });
  await store.saveScheduled(test);
  return json(200, { ok: true, id: test.id });
}

async function handleAdminDeleteScheduled(store: Store, params: Record<string, string | undefined>) {
  const id = str(params.id);
  if (!id) return json(400, { error: "id_required" });
  await store.deleteScheduled(id);
  return json(200, { ok: true, id });
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

async function handleHealth() {
  const store = await readyStore();
  return json(200, {
    ok: true,
    database: store.label === "postgres" ? store.detail : null,
    store: store.label
  });
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: { ...CORS },
      body: ""
    };
  }

  const path = (event.path || "").replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "");
  const params = (event.queryStringParameters ?? {}) as Record<string, string | undefined>;
  const method = event.httpMethod;

  try {
    /* -- learner routes ---------------------------------------------- */
    if (path === "/problems" && method === "GET") return await handleProblems(params);
    if (path === "/tests" && method === "GET") return await handleListTests(params);
    if (path === "/tests" && method === "POST") return await handleSaveTest(event, bodyOf(event));
    if (path === "/tests" && method === "DELETE") return await handleDeleteTest(params);
    if (path === "/scheduled-tests" && method === "GET") return await handleScheduledTests();
    if (path === "/standings" && method === "GET") return await handleStandings(event, params);
    if (path === "/leaderboard" && method === "GET") return await handleLeaderboard(event, params);
    if (path === "/health") return await handleHealth();

    /* -- learner accounts --------------------------------------------- */
    if (path === "/auth/signup" && method === "POST") return await handleSignup(bodyOf(event));
    if (path === "/auth/login" && method === "POST") return await handleLogin(bodyOf(event));
    if (path === "/auth/me" && method === "GET") return await handleMe(event);
    if (path === "/auth/profile" && method === "PUT") return await handleProfile(event, bodyOf(event));

    /* -- admin routes ------------------------------------------------- */
    if (path === "/admin/login" && method === "POST") return await handleAdminLogin(bodyOf(event));

    if (path.startsWith("/admin/")) {
      const store = await adminGate(event);
      if (!store) return json(401, { error: "unauthorized" });

      if (path === "/admin/overview" && method === "GET") return await handleAdminOverview(store);
      if (path === "/admin/submissions" && method === "GET") return await handleAdminSubmissions(store);
      if (path === "/admin/scheduled-tests" && method === "GET") return await handleAdminListScheduled(store);
      if (path === "/admin/scheduled-tests" && method === "POST")
        return await handleAdminSaveScheduled(store, bodyOf(event));
      if (path === "/admin/scheduled-tests" && method === "DELETE")
        return await handleAdminDeleteScheduled(store, params);
      if (path === "/admin/problems" && method === "POST")
        return await handleAdminSaveProblem(store, bodyOf(event));
      if (path === "/admin/problems" && method === "DELETE")
        return await handleAdminDeleteProblem(store, params);
      return json(404, { error: "not_found", path });
    }

    return json(404, { error: "not_found", path });
  } catch (err) {
    console.error("api error", err);
    return json(500, { error: "internal_error" });
  }
};
