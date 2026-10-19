/**
 * Netlify Function — the single API surface for Gonit Ishkul Problem Solving.
 *
 *   GET    /problems?type=&topic=&category=&difficulty=
 *   GET    /tests?clientId=
 *   POST   /tests
 *   DELETE /tests?id=&clientId=
 *   GET    /health
 *
 * It talks to Supabase's PostgreSQL over a direct/pooled TCP connection using
 * `pg`. The schema is created lazily and idempotently on the first request, and
 * the bundled problem bank is seeded into the database the first time it comes
 * up empty — so a brand-new project works with zero manual setup.
 *
 * Every handler degrades safely: if the database is unreachable the API answers
 * with a 503 and the front end quietly falls back to the bundled bank plus
 * localStorage, so the learner never sees a broken page.
 */

import type { Handler, HandlerEvent } from "@netlify/functions";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Database connection                                                 */
/* ------------------------------------------------------------------ */

const PROJECT_REF = "umyivdvsrimrbsxopgei";
const DB_PASSWORD = "XphPQ2@J4jZAj2C";

/** Connection strings tried in order. The first one that connects wins. */
function candidates(): { label: string; url: string }[] {
  const list: { label: string; url: string }[] = [];

  if (process.env.DATABASE_URL) {
    list.push({ label: "env", url: process.env.DATABASE_URL });
  }

  const enc = encodeURIComponent(DB_PASSWORD);
  // Supabase direct connection (IPv4/IPv6 depending on region).
  list.push({
    label: "direct",
    url: `postgresql://postgres:${enc}@db.${PROJECT_REF}.supabase.co:5432/postgres`
  });
  // Supabase transaction pooler — designed for serverless/IPv4 environments.
  // Pooled connections require the `postgres.<ref>` username.
  for (const region of ["ap-southeast-1", "us-east-1", "eu-west-1"]) {
    list.push({
      label: `pooler-${region}`,
      url: `postgresql://postgres.${PROJECT_REF}:${enc}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    });
  }
  return list;
}

type PgClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  end: () => Promise<void>;
  on: (event: string, cb: () => void) => void;
};

let cached: { client: PgClient; label: string } | null = null;
let connecting: Promise<{ client: PgClient; label: string } | null> | null = null;

async function connect(): Promise<{ client: PgClient; label: string } | null> {
  if (cached) return cached;
  if (connecting) return connecting;

  connecting = (async () => {
    // `pg` is loaded lazily so a missing/failed install never breaks cold starts
    // for the routes that don't need the database.
    let pg: typeof import("pg");
    try {
      pg = await import("pg");
    } catch {
      return null;
    }

    for (const candidate of candidates()) {
      const client = new pg.Client({
        connectionString: candidate.url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
        query_timeout: 12000,
        application_name: "gonit-ishkul-api"
      });
      try {
        await client.connect();
        // Cheap round-trip to confirm the session is really usable.
        await client.query("select 1");
        cached = { client: client as unknown as PgClient, label: candidate.label };
        return cached;
      } catch {
        try {
          await client.end();
        } catch {
          /* ignore */
        }
      }
    }
    return null;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

/* ------------------------------------------------------------------ */
/* Schema + seed                                                       */
/* ------------------------------------------------------------------ */

const SCHEMA = `
create table if not exists problems (
  id           text primary key,
  slug         text unique not null,
  type         text not null,
  topic        text not null,
  category     text not null,
  difficulty   text not null,
  title_bn     text not null,
  title_en     text not null,
  statement_bn text not null,
  statement_en text not null,
  answer       text not null,
  solution_bn  text not null,
  solution_en  text not null,
  source       text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists problems_topic_idx     on problems (topic);
create index if not exists problems_type_idx      on problems (type);
create index if not exists problems_category_idx  on problems (category);
create index if not exists problems_difficulty_idx on problems (difficulty);

create table if not exists practice_tests (
  id            uuid primary key,
  client_id     text not null,
  title         text not null,
  filters       jsonb not null default '{}'::jsonb,
  problem_ids   jsonb not null default '[]'::jsonb,
  duration_min  integer not null default 20,
  status        text not null default 'IN_PROGRESS',
  answers       jsonb not null default '[]'::jsonb,
  score         integer not null default 0,
  max_score     integer not null default 0,
  correct_count integer not null default 0,
  started_at    timestamptz not null,
  submitted_at  timestamptz,
  timed_out     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists practice_tests_client_idx on practice_tests (client_id, created_at desc);
`;

let prepared = false;

/** Create the schema, then seed the bank if the table is empty. */
async function ensurePrepared(client: PgClient): Promise<void> {
  if (prepared) return;
  await client.query(SCHEMA);

  const count = await client.query("select count(*)::int as n from problems");
  if ((count.rows[0]?.n as number) === 0) {
    await seedProblems(client);
  }
  prepared = true;
}

/** Load the bundled JSON bank and upsert it into Postgres. */
async function seedProblems(client: PgClient): Promise<void> {
  let bank: Record<string, unknown>[];
  try {
    // Netlify's esbuild bundler inlines this asset at build time.
    const raw = readFileSync(join(process.cwd(), "dist", "data", "problems.json"), "utf8");
    bank = JSON.parse(raw) as Record<string, unknown>[];
  } catch {
    bank = FALLBACK_BANK;
  }
  if (!bank.length) return;

  for (const p of bank) {
    await client.query(
      `insert into problems
         (id, slug, type, topic, category, difficulty,
          title_bn, title_en, statement_bn, statement_en,
          answer, solution_bn, solution_en, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (id) do update set
         slug = excluded.slug, type = excluded.type, topic = excluded.topic,
         category = excluded.category, difficulty = excluded.difficulty,
         title_bn = excluded.title_bn, title_en = excluded.title_en,
         statement_bn = excluded.statement_bn, statement_en = excluded.statement_en,
         answer = excluded.answer, solution_bn = excluded.solution_bn,
         solution_en = excluded.solution_en, source = excluded.source`,
      [
        p.id,
        p.slug,
        p.type,
        p.topic,
        p.category,
        p.difficulty,
        (p.title as { bn: string }).bn,
        (p.title as { en: string }).en,
        (p.statement as { bn: string }).bn,
        (p.statement as { en: string }).en,
        p.answer,
        (p.solution as { bn: string }).bn,
        (p.solution as { en: string }).en,
        p.source
      ]
    );
  }
}

/** Tiny inlined fallback used when the asset pipeline can't be read. */
const FALLBACK_BANK: Record<string, unknown>[] = [];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
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

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

async function handleProblems(params: Record<string, string | undefined>) {
  const conn = await connect();
  if (!conn) return json(503, { error: "database_unavailable", problems: [] });
  await ensurePrepared(conn.client);

  const types = parseList(params.type, ALLOWED.type);
  const topics = parseList(params.topic, ALLOWED.topic);
  const categories = parseList(params.category, ALLOWED.category);
  const difficulties = parseList(params.difficulty, ALLOWED.difficulty);

  const where: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, list: string[]) => {
    if (!list.length) return;
    values.push(list);
    where.push(`${column} = any($${values.length}::text[])`);
  };
  push("type", types);
  push("topic", topics);
  push("category", categories);
  push("difficulty", difficulties);

  const sql = `select id, slug, type, topic, category, difficulty,
                      title_bn, title_en, statement_bn, statement_en,
                      answer, solution_bn, solution_en, source
               from problems
               ${where.length ? `where ${where.join(" and ")}` : ""}
               order by topic, difficulty, id`;

  const res = await conn.client.query(sql, values);
  const problems = res.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    type: r.type,
    topic: r.topic,
    category: r.category,
    difficulty: r.difficulty,
    title: { bn: r.title_bn, en: r.title_en },
    statement: { bn: r.statement_bn, en: r.statement_en },
    answer: r.answer,
    solution: { bn: r.solution_bn, en: r.solution_en },
    source: r.source
  }));

  return json(200, { problems, count: problems.length, db: conn.label });
}

async function handleListTests(params: Record<string, string | undefined>) {
  const clientId = params.clientId;
  if (!clientId) return json(400, { error: "client_id_required" });

  const conn = await connect();
  if (!conn) return json(503, { error: "database_unavailable", tests: [] });
  await ensurePrepared(conn.client);

  const res = await conn.client.query(
    `select id, client_id, title, filters, problem_ids, duration_min, status,
            answers, score, max_score, correct_count, started_at, submitted_at, timed_out
     from practice_tests
     where client_id = $1
     order by created_at desc
     limit 200`,
    [clientId]
  );

  const tests = res.rows.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    filters: r.filters,
    problemIds: r.problem_ids,
    durationMin: r.duration_min,
    status: r.status,
    answers: r.answers,
    score: r.score,
    maxScore: r.max_score,
    correctCount: r.correct_count,
    startedAt: r.started_at,
    submittedAt: r.submitted_at ?? undefined,
    timedOut: Boolean(r.timed_out),
    origin: "cloud" as const
  }));

  return json(200, { tests });
}

async function handleSaveTest(body: Record<string, unknown>) {
  const id = typeof body.id === "string" ? body.id : null;
  const clientId = typeof body.clientId === "string" ? body.clientId : null;
  if (!id || !clientId) return json(400, { error: "id_and_client_id_required" });

  const conn = await connect();
  if (!conn) return json(503, { error: "database_unavailable" });
  await ensurePrepared(conn.client);

  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

  const submittedAt = typeof body.submittedAt === "string" ? body.submittedAt : null;

  await conn.client.query(
    `insert into practice_tests
       (id, client_id, title, filters, problem_ids, duration_min, status,
        answers, score, max_score, correct_count, started_at, submitted_at, timed_out)
     values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)
     on conflict (id) do update set
       title = excluded.title,
       filters = excluded.filters,
       problem_ids = excluded.problem_ids,
       duration_min = excluded.duration_min,
       status = excluded.status,
       answers = excluded.answers,
       score = excluded.score,
       max_score = excluded.max_score,
       correct_count = excluded.correct_count,
       submitted_at = excluded.submitted_at,
       timed_out = excluded.timed_out`,
    [
      id,
      clientId,
      str(body.title, "Practice test"),
      JSON.stringify(body.filters ?? {}),
      JSON.stringify(asArray(body.problemIds)),
      Math.max(1, Math.min(240, Math.round(num(body.durationMin, 20)))),
      str(body.status, "IN_PROGRESS"),
      JSON.stringify(asArray(body.answers)),
      Math.round(num(body.score)),
      Math.round(num(body.maxScore)),
      Math.round(num(body.correctCount)),
      typeof body.startedAt === "string" ? body.startedAt : new Date().toISOString(),
      submittedAt,
      Boolean(body.timedOut)
    ]
  );

  return json(200, { ok: true, id });
}

async function handleDeleteTest(params: Record<string, string | undefined>) {
  const id = params.id;
  const clientId = params.clientId;
  if (!id || !clientId) return json(400, { error: "id_and_client_id_required" });

  const conn = await connect();
  if (!conn) return json(503, { error: "database_unavailable" });
  await ensurePrepared(conn.client);

  // Scoped by client_id so one learner can never delete another's paper.
  await conn.client.query("delete from practice_tests where id = $1::uuid and client_id = $2", [id, clientId]);
  return json(200, { ok: true });
}

async function handleHealth() {
  const conn = await connect();
  return json(200, { ok: true, database: conn ? conn.label : null });
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
      },
      body: ""
    };
  }

  const path = (event.path || "").replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "");
  const params = (event.queryStringParameters ?? {}) as Record<string, string | undefined>;

  try {
    if (path === "/problems" && event.httpMethod === "GET") return await handleProblems(params);
    if (path === "/tests" && event.httpMethod === "GET") return await handleListTests(params);
    if (path === "/tests" && event.httpMethod === "POST") {
      const body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
      return await handleSaveTest(body);
    }
    if (path === "/tests" && event.httpMethod === "DELETE") return await handleDeleteTest(params);
    if (path === "/health") return await handleHealth();

    return json(404, { error: "not_found", path });
  } catch (err) {
    console.error("api error", err);
    return json(500, { error: "internal_error" });
  }
};
