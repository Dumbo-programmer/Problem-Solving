/**
 * API contract smoke test.
 *
 * Boots the real Netlify Function on plain Node (see scripts/api-server.mjs)
 * with an isolated JSON store, then exercises every route: learner reads and
 * writes, standings, both leaderboard windows, admin auth + CRUD, CORS and
 * error shapes. Exits non-zero on the first violated contract.
 */
import { rmSync } from "node:fs";
import path from "node:path";
import { startApi } from "./api-server.mjs";

const STORE_FILE = path.join(process.cwd(), ".data", "smoke-store.json");
rmSync(STORE_FILE, { force: true }); // fresh seed for a deterministic run
process.env.STORE = "file";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const { base, close } = await startApi({ port: 8919, storeFile: STORE_FILE, quiet: true });

async function call(method, p, { body, token } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, data, headers: res.headers };
}

const fail = (msg) => {
  console.error(`\nABORT: ${msg}`);
  process.exit(1);
};

try {
  /* ---------- health + learner reads ---------- */
  const health = await call("GET", "/health");
  check("GET /health is live on the file store", health.status === 200 && health.data?.ok === true, `store=${health.data?.store}`);
  check("health names a store", health.data?.store === "file" || health.data?.store === "postgres", health.data?.store);

  const all = await call("GET", "/problems");
  const total = all.data?.count ?? 0;
  check("GET /problems serves the bundled bank", all.status === 200 && total >= 100, `${total} problems via ${all.data?.db}`);

  const geom = await call("GET", "/problems?topic=GEOMETRY");
  check("facet filter narrows the bank", geom.status === 200 && geom.data.count > 0 && geom.data.count < total, `${geom.data.count} geometry`);

  const noClient = await call("GET", "/tests");
  check("GET /tests without clientId is a 400", noClient.status === 400, noClient.data?.error);

  /* ---------- scheduled papers ---------- */
  const sched = await call("GET", "/scheduled-tests");
  const papers = sched.data?.tests ?? [];
  check("GET /scheduled-tests returns the calendar papers", sched.status === 200 && papers.length >= 5, `${papers.length} papers`);
  check("paper ids are calendar-derived", papers.every((t) => /^(wk|mo)-\d{4}-\d{2}$/.test(t.id)));
  check("public list only exposes published papers", papers.every((t) => t.published === true));
  check("papers carry participant counts", papers.every((t) => typeof t.participants === "number"), `e.g. ${papers[0]?.participants}`);

  const nowMs = Date.now();
  const livePaper =
    papers.find((t) => Date.parse(t.startAt) <= nowMs && nowMs < Date.parse(t.endAt) && t.kind === "WEEKLY") ??
    papers.find((t) => Date.parse(t.startAt) <= nowMs && nowMs < Date.parse(t.endAt));
  check("a paper is live right now", Boolean(livePaper), livePaper?.id ?? "none");

  const noTest = await call("GET", "/standings");
  check("GET /standings without testId is a 400", noTest.status === 400, noTest.data?.error);

  const st = await call("GET", `/standings?testId=${encodeURIComponent(livePaper?.id ?? "")}`);
  const rows = st.data?.rows ?? [];
  check("live paper has seeded standings", st.status === 200 && rows.length >= 6, `${rows.length} rows`);
  check("standings ranks ascend from 1", rows.every((r, i) => r.rank === i + 1));
  check("standings sort by score % desc", rows.every((r, i) => i === 0 || rows[i - 1].pct >= r.pct), `${rows[0]?.pct}% → ${rows.at(-1)?.pct}%`);
  check("standings show names", rows.every((r) => r.name && r.name.trim()), rows[0]?.name);

  /* ---------- overall leaderboard ---------- */
  const badWin = await call("GET", "/leaderboard?window=year");
  check("bad leaderboard window is a 400", badWin.status === 400, badWin.data?.error);

  const lbAll = await call("GET", "/leaderboard?window=all");
  const lbRows = lbAll.data?.rows ?? [];
  check("GET /leaderboard (all) is populated", lbAll.status === 200 && lbRows.length >= 6, `${lbRows.length} learners`);
  check("leaderboard ranks ascend from 1", lbRows.every((r, i) => r.rank === i + 1));
  check("leaderboard sorts by problems solved desc", lbRows.every((r, i) => i === 0 || lbRows[i - 1].correct >= r.correct), `${lbRows[0]?.correct} → ${lbRows.at(-1)?.correct}`);

  const lbWeek = await call("GET", "/leaderboard?window=week");
  const lbMonth = await call("GET", "/leaderboard?window=month");
  check("weekly and monthly windows answer", lbWeek.status === 200 && lbMonth.status === 200, `week=${lbWeek.data?.rows?.length} month=${lbMonth.data?.rows?.length}`);
  check("windows never grow going week → month → all", (lbWeek.data?.rows?.length ?? 0) <= (lbMonth.data?.rows?.length ?? 0) && (lbMonth.data?.rows?.length ?? 0) <= lbRows.length);
  check("window defaults to all-time", (await call("GET", "/leaderboard")).data?.window === "all");

  /* ---------- learner entry round-trip ---------- */
  // Boards only rank attempts tied to a signed-in account, so this entry is
  // posted with a learner bearer (the server derives the account from it).
  const entryUser = await call("POST", "/auth/signup", {
    body: {
      username: `entry${Date.now().toString(36)}`,
      password: "long-enough",
      displayName: "Smoke Tester",
      email: `entry${Date.now().toString(36)}@example.com`,
      phone: "+8801700000009"
    }
  });
  const entryToken = entryUser.data?.token;

  const entryId = `smoke-${Date.now()}`;
  const entry = {
    id: entryId,
    clientId: "smoke-client",
    title: "Smoke entry",
    filters: { types: [], topics: [], categories: [], difficulties: [] },
    problemIds: livePaper?.problemIds ?? [],
    durationMin: 45,
    status: "SUBMITTED",
    answers: [],
    score: 1,
    maxScore: 2,
    correctCount: 1,
    startedAt: new Date(nowMs - 60_000).toISOString(),
    submittedAt: new Date(nowMs).toISOString(),
    scheduledTestId: livePaper?.id,
    displayName: "Smoke Tester"
  };

  const saved = await call("POST", "/tests", { body: entry, token: entryToken });
  check("POST /tests files an entry", saved.status === 200 && saved.data?.ok === true);

  const mine = await call("GET", "/tests?clientId=smoke-client");
  check("entry is listed for its client", mine.status === 200 && mine.data.tests.some((t) => t.id === entryId), `${mine.data.tests.length} entries`);

  const st2 = await call("GET", `/standings?testId=${encodeURIComponent(livePaper?.id)}`);
  check("entry lands in the standings", (st2.data?.rows ?? []).some((r) => r.name === "Smoke Tester"), `${st2.data.rows.length} rows`);

  const st2You = await call("GET", `/standings?testId=${encodeURIComponent(livePaper?.id)}`, { token: entryToken });
  check(
    "standings mark the caller's own row",
    (st2You.data?.rows ?? []).some((r) => r.name === "Smoke Tester" && r.isYou === true),
    "isYou flag"
  );

  const del = await call("DELETE", `/tests?id=${entryId}&clientId=smoke-client`);
  const st3 = await call("GET", `/standings?testId=${encodeURIComponent(livePaper?.id)}`);
  check("DELETE /tests removes the entry", del.status === 200 && !(st3.data?.rows ?? []).some((r) => r.name === "Smoke Tester"));

  const delBad = await call("DELETE", "/tests");
  check("DELETE /tests without ids is a 400", delBad.status === 400, delBad.data?.error);

  // An anonymous attempt is filed but must never appear on a public board.
  const anonEntry = { ...entry, id: `${entryId}-anon`, clientId: "smoke-anon" };
  await call("POST", "/tests", { body: anonEntry });
  const stAnon = await call("GET", `/standings?testId=${encodeURIComponent(livePaper?.id)}`);
  check(
    "anonymous attempts stay off the boards",
    !(stAnon.data?.rows ?? []).some((r) => r.clientId === "smoke-anon"),
    "not ranked"
  );
  await call("DELETE", `/tests?id=${entryId}-anon&clientId=smoke-anon`);

  /* ---------- learner accounts ---------- */
  const badUser = await call("POST", "/auth/signup", {
    body: { username: "no spaces!", password: "long-enough", displayName: "X" }
  });
  check("signup rejects invalid usernames", badUser.status === 400 && badUser.data?.error === "invalid_username", badUser.data?.error);

  const badPw = await call("POST", "/auth/signup", {
    body: { username: "smokeuser", password: "short", displayName: "X" }
  });
  check("signup rejects short passwords", badPw.status === 400 && badPw.data?.error === "invalid_password", badPw.data?.error);

  const noName = await call("POST", "/auth/signup", {
    body: {
      username: "smokeuser",
      password: "long-enough",
      displayName: "   ",
      email: "smoke@example.com",
      phone: "+8801700000000"
    }
  });
  check("signup requires a display name", noName.status === 400 && noName.data?.error === "display_name_required", noName.data?.error);

  const badEmail = await call("POST", "/auth/signup", {
    body: {
      username: "smokeuser",
      password: "long-enough",
      displayName: "Smoke User",
      email: "not-an-email",
      phone: "+8801700000000"
    }
  });
  check("signup rejects malformed emails", badEmail.status === 400 && badEmail.data?.error === "invalid_email", badEmail.data?.error);

  const badPhone = await call("POST", "/auth/signup", {
    body: {
      username: "smokeuser",
      password: "long-enough",
      displayName: "Smoke User",
      email: "smoke@example.com",
      phone: "12"
    }
  });
  check("signup rejects malformed phone numbers", badPhone.status === 400 && badPhone.data?.error === "invalid_phone", badPhone.data?.error);

  const signup = await call("POST", "/auth/signup", {
    body: {
      username: "SmokeUser",
      password: "long-enough",
      displayName: "Smoke User",
      email: "Smoke@Example.com",
      phone: "+880 1700-000000"
    }
  });
  const learnerToken = signup.data?.token;
  check("signup issues a learner session", signup.status === 200 && typeof learnerToken === "string", signup.data?.error ?? "token issued");
  check("usernames are normalised to lowercase", signup.data?.user?.username === "smokeuser", signup.data?.user?.username);
  check("signup echoes the profile", signup.data?.user?.displayName === "Smoke User" && typeof signup.data?.user?.createdAt === "string");
  check("emails are normalised to lowercase", signup.data?.user?.email === "smoke@example.com", signup.data?.user?.email);
  check("phone numbers are stored as digits", signup.data?.user?.phone === "+8801700000000", signup.data?.user?.phone);
  check("password hashes never leave the server", !JSON.stringify(signup.data).includes("passwordHash") && !JSON.stringify(signup.data).includes("scrypt$"));

  const dup = await call("POST", "/auth/signup", {
    body: {
      username: "smokeuser",
      password: "another-pass",
      displayName: "Impostor",
      email: "other@example.com",
      phone: "+8801700000001"
    }
  });
  check("duplicate usernames are a 409", dup.status === 409 && dup.data?.error === "username_taken", `${dup.status} ${dup.data?.error}`);

  const dupEmail = await call("POST", "/auth/signup", {
    body: {
      username: "smokeuser2",
      password: "another-pass",
      displayName: "Impostor Two",
      email: "SMOKE@example.com",
      phone: "+8801700000002"
    }
  });
  check("duplicate emails are a 409", dupEmail.status === 409 && dupEmail.data?.error === "email_taken", `${dupEmail.status} ${dupEmail.data?.error}`);

  const ghost = await call("POST", "/auth/login", { body: { username: "ghost", password: "long-enough" } });
  check("unknown usernames fail like wrong passwords", ghost.status === 401 && ghost.data?.error === "bad_credentials", ghost.data?.error);

  const wrongPw = await call("POST", "/auth/login", { body: { username: "smokeuser", password: "wrong-password" } });
  check("wrong passwords are a 401", wrongPw.status === 401 && wrongPw.data?.error === "bad_credentials", wrongPw.data?.error);

  const loginLearner = await call("POST", "/auth/login", { body: { username: "SMOKEUSER ", password: "long-enough" } });
  check("login accepts the username in any case", loginLearner.status === 200 && loginLearner.data?.user?.username === "smokeuser", loginLearner.data?.error ?? "ok");

  const meNoTok = await call("GET", "/auth/me");
  check("GET /auth/me without a session is a 401", meNoTok.status === 401, meNoTok.data?.error);

  const meBadTok = await call("GET", "/auth/me", { token: "not-a-token" });
  check("GET /auth/me rejects forged tokens", meBadTok.status === 401, meBadTok.data?.error);

  // The documented admin pair (see the admin section below for its own use).
  const adminForKind = await call("POST", "/admin/login", { body: { id: "admin", password: "gonit-ishkul" } });
  const meAdminTok = await call("GET", "/auth/me", { token: adminForKind.data?.token });
  check("an admin token is not a learner session", meAdminTok.status === 401, meAdminTok.data?.error);

  const me = await call("GET", "/auth/me", { token: learnerToken });
  check("GET /auth/me answers with the profile", me.status === 200 && me.data?.user?.username === "smokeuser", me.data?.user?.username);

  const adminAsLearner = await call("GET", "/admin/overview", { token: learnerToken });
  check("a learner session cannot open admin routes", adminAsLearner.status === 401, adminAsLearner.data?.error);

  const rename = await call("PUT", "/auth/profile", { body: { displayName: "Smoke Renamed" }, token: learnerToken });
  const meAfter = await call("GET", "/auth/me", { token: learnerToken });
  check("PUT /auth/profile renames the account", rename.status === 200 && meAfter.data?.user?.displayName === "Smoke Renamed", meAfter.data?.user?.displayName);

  const renameAnon = await call("PUT", "/auth/profile", { body: { displayName: "Hacker" } });
  check("renaming requires a session", renameAnon.status === 401, renameAnon.data?.error);

  const relogin = await call("POST", "/auth/login", { body: { username: "smokeuser", password: "long-enough" } });
  check("renames survive a fresh login", relogin.data?.user?.displayName === "Smoke Renamed", relogin.data?.user?.displayName);

  /* ---------- admin: auth ---------- */
  const wrongLogin = await call("POST", "/admin/login", { body: { id: "admin", password: "nope" } });
  check("bad admin credentials are a 401", wrongLogin.status === 401, wrongLogin.data?.error);

  const login = await call("POST", "/admin/login", { body: { id: "admin", password: "gonit-ishkul" } });
  const token = login.data?.token;
  check("default admin credentials sign in", login.status === 200 && typeof token === "string", token ? "token issued" : JSON.stringify(login.data));
  check("token carries a future expiry", Number(login.data?.expiresAt) > Date.now(), new Date(login.data?.expiresAt ?? 0).toISOString());

  const noTok = await call("GET", "/admin/overview");
  const badTok = await call("GET", "/admin/overview", { token: "not-a-token" });
  check("admin routes reject missing tokens", noTok.status === 401, noTok.data?.error);
  check("admin routes reject forged tokens", badTok.status === 401, badTok.data?.error);

  /* ---------- admin: read ---------- */
  const overview = await call("GET", "/admin/overview", { token });
  check("GET /admin/overview answers", overview.status === 200 && typeof overview.data?.problems === "number", `problems=${overview.data?.problems} tests=${overview.data?.tests} live=${overview.data?.live}`);
  check("overview counts cover the bank + papers", overview.data.problems >= 100 && overview.data.tests >= 5);
  check("overview reports its data source", overview.data.source === "file" || overview.data.source === "postgres", `${overview.data.source} (${overview.data.detail})`);
  check("overview counts live papers", typeof overview.data.live === "number" && overview.data.live >= 1, `${overview.data.live} live`);
  check("overview counts learner accounts", typeof overview.data.accounts === "number" && overview.data.accounts >= 1, `${overview.data.accounts} accounts`);

  const subs = await call("GET", "/admin/submissions", { token });
  check("GET /admin/submissions lists seeded entries", subs.status === 200 && (subs.data?.submissions?.length ?? 0) >= 6, `${subs.data?.submissions?.length} submissions`);
  check("submission rows are shaped", subs.data.submissions.every((s) => typeof s.pct === "number" && typeof s.name === "string" && typeof s.timeTakenSec === "number"));

  const adminTests = await call("GET", "/admin/scheduled-tests", { token });
  check("admin sees every paper", adminTests.status === 200 && adminTests.data.tests.length >= 5, `${adminTests.data.tests.length} papers`);

  /* ---------- admin: problem CRUD ---------- */
  const baseline = overview.data.problems;
  const problem = {
    problem: {
      id: "smoke-problem-1",
      type: "ACADEMICS",
      topic: "ALGEBRA",
      category: "JUNIOR",
      difficulty: "EASY",
      title: { bn: "স্মোক প্রশ্ন", en: "Smoke question" },
      statement: { bn: "২ + ২ কত?", en: "What is 2 + 2?" },
      answer: "4",
      solution: { bn: "২ + ২ = ৪", en: "2 + 2 = 4" },
      source: "smoke"
    }
  };
  const created = await call("POST", "/admin/problems", { body: problem, token });
  check("POST /admin/problems creates a problem", created.status === 200 && created.data?.ok === true, created.data?.error);

  const bumped = await call("GET", "/admin/overview", { token });
  check("creating bumps the overview count", bumped.data.problems === baseline + 1, `${baseline} → ${bumped.data.problems}`);

  const again = await call("POST", "/admin/problems", { body: problem, token });
  const same = await call("GET", "/admin/overview", { token });
  check("re-saving upserts instead of duplicating", again.status === 200 && same.data.problems === baseline + 1, `${same.data.problems}`);

  const invalid = await call("POST", "/admin/problems", { body: { problem: { id: "x" } }, token });
  check("invalid problems are a 400", invalid.status === 400, invalid.data?.error);

  const removed = await call("DELETE", "/admin/problems?id=smoke-problem-1", { token });
  const back = await call("GET", "/admin/overview", { token });
  check("DELETE /admin/problems removes it", removed.status === 200 && back.data.problems === baseline, `${back.data.problems}`);

  /* ---------- admin: scheduled paper CRUD ---------- */
  const paper = {
    test: {
      id: "smoke-custom-1",
      kind: "CUSTOM",
      title: { bn: "স্মোক টেস্ট", en: "Smoke test" },
      description: { bn: "স্মোক", en: "Smoke" },
      startAt: new Date(nowMs - 3_600_000).toISOString(),
      endAt: new Date(nowMs + 3_600_000).toISOString(),
      durationMin: 30,
      problemIds: ["smoke-problem-1"],
      published: false
    }
  };

  const mkPaper = await call("POST", "/admin/scheduled-tests", { body: paper, token });
  check("POST /admin/scheduled-tests creates a paper", mkPaper.status === 200 && mkPaper.data?.ok === true, mkPaper.data?.error);

  const adminList = await call("GET", "/admin/scheduled-tests", { token });
  const publicList = await call("GET", "/scheduled-tests");
  check("admin sees the unpublished paper", adminList.data.tests.some((t) => t.id === "smoke-custom-1"));
  check("public list hides the unpublished paper", !publicList.data.tests.some((t) => t.id === "smoke-custom-1"));

  const badPaper = await call("POST", "/admin/scheduled-tests", { body: { test: { id: "x", title: { bn: "x", en: "x" }, startAt: "2026-01-02T00:00:00Z", endAt: "2026-01-01T00:00:00Z", problemIds: ["p"] } }, token });
  check("inverted windows are a 400", badPaper.status === 400, badPaper.data?.error);

  const rmPaper = await call("DELETE", "/admin/scheduled-tests?id=smoke-custom-1", { token });
  const afterRm = await call("GET", "/admin/scheduled-tests", { token });
  check("DELETE /admin/scheduled-tests removes it", rmPaper.status === 200 && !afterRm.data.tests.some((t) => t.id === "smoke-custom-1"));

  /* ---------- protocol edges ---------- */
  const opt = await fetch(`${base}/problems`, { method: "OPTIONS" });
  check("CORS preflight answers 204", opt.status === 204 && opt.headers.get("access-control-allow-origin") === "*");

  const missing = await call("GET", "/definitely-not-a-route");
  check("unknown routes are a 404", missing.status === 404, missing.data?.error);
} finally {
  await close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} API checks passed`);
if (failed.length) {
  failed.forEach((f) => console.log(`  ✗ ${f.name}`));
  process.exit(1);
}
