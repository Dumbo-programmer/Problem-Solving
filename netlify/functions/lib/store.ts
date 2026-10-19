import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PROBLEMS } from "../../../src/data";
import type { PracticeTest, Problem, ScheduledTest, TestAnswer } from "../../../src/lib/types";
import { buildDemoEntries, buildScheduledSeeds } from "../../../src/lib/scheduled";

/**
 * Storage behind the API, with two interchangeable implementations:
 *
 *   • PgStore   — Supabase Postgres over `pg` (the production path);
 *   • FileStore — a JSON document on disk (used when no database is reachable,
 *                 so the API — and therefore the site — keeps working anywhere,
 *                 including local `npm run dev:api` and smoke runs).
 *
 * Both are seeded from the same bundled sources (the 144-problem bank, the
 * calendar-derived weekly/monthly papers and the demo leaderboard entries), so
 * the two paths serve near-identical data.
 */

export interface ProblemFilters {
  types?: string[];
  topics?: string[];
  categories?: string[];
  difficulties?: string[];
}

export interface StoreOverview {
  problems: number;
  tests: number;
  submissions: number;
  learners: number;
  /** Registered learner accounts (username + password). */
  accounts: number;
}

/** A registered learner. `username` is normalized to lowercase at the edge. */
export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  /** Contact details captured at sign-up (optional on legacy accounts). */
  email?: string;
  phone?: string;
  passwordHash: string;
  createdAt: string;
}

export interface Store {
  /** "postgres" or "file" — surfaced on /health and the admin overview. */
  readonly label: "postgres" | "file";
  /** Connection detail (candidate label or file path) for diagnostics. */
  readonly detail: string;

  listProblems(filters: ProblemFilters): Promise<Problem[]>;
  saveProblem(problem: Problem): Promise<void>;
  deleteProblem(id: string): Promise<void>;

  listTests(clientId: string): Promise<PracticeTest[]>;
  saveTest(test: PracticeTest): Promise<void>;
  deleteTest(id: string, clientId: string): Promise<void>;

  findUserByUsername(username: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  /** True when the email is already registered to another account. */
  findUserByEmail(email: string): Promise<StoredUser | null>;
  /** Creates the account; false when the username is already taken. */
  createUser(user: StoredUser): Promise<boolean>;
  setUserDisplayName(id: string, displayName: string): Promise<void>;

  listScheduled(includeUnpublished: boolean): Promise<ScheduledTest[]>;
  saveScheduled(test: ScheduledTest): Promise<void>;
  deleteScheduled(id: string): Promise<void>;

  /** Applies schema/migrations and seeds the bank, papers and demo entries. */
  ensureSeeded(): Promise<void>;

  /** Submitted entries for scheduled tests — the leaderboard universe. */
  listEntries(): Promise<PracticeTest[]>;
  overview(): Promise<StoreOverview>;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function anyOf(selected: string[] | undefined, value: string): boolean {
  return !selected || selected.length === 0 || selected.includes(value);
}

export function filterProblemsJS(problems: Problem[], f: ProblemFilters): Problem[] {
  return problems.filter(
    (p) =>
      anyOf(f.types, p.type) &&
      anyOf(f.topics, p.topic) &&
      anyOf(f.categories, p.category) &&
      anyOf(f.difficulties, p.difficulty)
  );
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}

const EMPTY_FILTERS: PracticeTest["filters"] = {
  types: [],
  topics: [],
  categories: [],
  difficulties: []
};

/** Entries + papers are seeded identically in both stores. */
function seedPapers(now = Date.now(), exclude?: Iterable<string>): ScheduledTest[] {
  return buildScheduledSeeds(PROBLEMS, new Date(now), { exclude });
}

function seedEntries(papers: ScheduledTest[], now = Date.now()): PracticeTest[] {
  return buildDemoEntries(papers, now);
}

/* ------------------------------------------------------------------ */
/* Postgres                                                            */
/* ------------------------------------------------------------------ */

const PROJECT_REF = "umyivdvsrimrbsxopgei";
const DB_PASSWORD = "XphPQ2@J4jZAj2C";

type PgClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  end: () => Promise<void>;
};

/** Connection strings tried in order. The first one that connects wins. */
function candidates(): { label: string; url: string }[] {
  const list: { label: string; url: string }[] = [];
  if (process.env.DATABASE_URL) list.push({ label: "env", url: process.env.DATABASE_URL });

  const enc = encodeURIComponent(DB_PASSWORD);
  list.push({
    label: "direct",
    url: `postgresql://postgres:${enc}@db.${PROJECT_REF}.supabase.co:5432/postgres`
  });
  // Supabase transaction pooler — designed for serverless/IPv4 environments.
  for (const region of ["ap-southeast-1", "us-east-1", "eu-west-1"]) {
    list.push({
      label: `pooler-${region}`,
      url: `postgresql://postgres.${PROJECT_REF}:${enc}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    });
  }
  return list;
}

let cached: { client: PgClient; label: string } | null = null;
let connecting: Promise<{ client: PgClient; label: string } | null> | null = null;

async function connectPg(): Promise<{ client: PgClient; label: string } | null> {
  if (cached) return cached;
  if (connecting) return connecting;

  connecting = (async () => {
    // `pg` loads lazily so a missing install never breaks cold starts.
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
        connectionTimeoutMillis: 4000,
        query_timeout: 12000,
        application_name: "gonit-ishkul-api"
      });
      try {
        await client.connect();
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

create index if not exists problems_topic_idx      on problems (topic);
create index if not exists problems_type_idx       on problems (type);
create index if not exists problems_category_idx   on problems (category);
create index if not exists problems_difficulty_idx on problems (difficulty);

create table if not exists practice_tests (
  id                text primary key,
  client_id         text not null,
  title             text not null,
  filters           jsonb not null default '{}'::jsonb,
  problem_ids       jsonb not null default '[]'::jsonb,
  duration_min      integer not null default 20,
  status            text not null default 'IN_PROGRESS',
  answers           jsonb not null default '[]'::jsonb,
  score             integer not null default 0,
  max_score         integer not null default 0,
  correct_count     integer not null default 0,
  started_at        timestamptz not null,
  submitted_at      timestamptz,
  timed_out         boolean not null default false,
  scheduled_test_id text,
  display_name      text,
  account_id        text,
  created_at        timestamptz not null default now()
);

create index if not exists practice_tests_client_idx    on practice_tests (client_id, created_at desc);
create index if not exists practice_tests_scheduled_idx on practice_tests (scheduled_test_id);
create index if not exists practice_tests_account_idx   on practice_tests (account_id);

create table if not exists users (
  id            text primary key,
  username      text not null unique,
  display_name  text not null,
  email         text,
  phone         text,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create unique index if not exists users_email_idx on users (lower(email)) where email is not null;

create table if not exists scheduled_tests (
  id              text primary key,
  kind            text not null default 'CUSTOM',
  title_bn        text not null,
  title_en        text not null,
  description_bn  text not null default '',
  description_en  text not null default '',
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  duration_min    integer not null default 45,
  problem_ids     jsonb not null default '[]'::jsonb,
  published       boolean not null default true,
  created_at      timestamptz not null default now()
);
`;

/** Upgrades a database created before scheduled tests existed. Idempotent. */
const MIGRATIONS = [
  // The original table used uuid ids; demo/admin ids are not UUIDs.
  "alter table practice_tests alter column id type text using id::text",
  "alter table practice_tests add column if not exists scheduled_test_id text",
  "alter table practice_tests add column if not exists display_name text",
  // Boards only rank attempts tied to a signed-in account.
  "alter table practice_tests add column if not exists account_id text",
  "create index if not exists practice_tests_account_idx on practice_tests (account_id)",
  // Contact details captured at sign-up.
  "alter table users add column if not exists email text",
  "alter table users add column if not exists phone text",
  "create unique index if not exists users_email_idx on users (lower(email)) where email is not null"
];

export class PgStore implements Store {
  readonly label = "postgres" as const;

  constructor(
    private readonly client: PgClient,
    readonly detail: string
  ) {}

  private seeded = false;

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    await this.client.query(SCHEMA);
    for (const sql of MIGRATIONS) {
      try {
        await this.client.query(sql);
      } catch {
        /* already applied / table brand new */
      }
    }

    // 1. Problem bank: insert only ids we don't have (never clobbers edits).
    const have = await this.client.query("select id from problems");
    const known = new Set(have.rows.map((r) => String(r.id)));
    const missing = PROBLEMS.filter((p) => !known.has(p.id));
    for (const p of missing) await this.insertProblem(p);

    // 2. Calendar papers: insert any week/month not present yet. Problems
    //    already claimed by papers in the database are excluded, so a freshly
    //    rolled week never repeats what past weeks already tested.
    const haveTests = await this.client.query("select id, problem_ids from scheduled_tests");
    const knownTests = new Set(haveTests.rows.map((r) => String(r.id)));
    const claimed = haveTests.rows.flatMap((r) => (r.problem_ids as string[]) ?? []);
    const papers = seedPapers(Date.now(), claimed);
    for (const t of papers) {
      if (!knownTests.has(t.id)) await this.saveScheduled(t);
    }

    // 3. Demo leaderboard entries for papers that have already begun.
    const haveDemo = await this.client.query("select id from practice_tests where client_id like 'demo-%'");
    const knownDemo = new Set(haveDemo.rows.map((r) => String(r.id)));
    for (const e of seedEntries(papers)) {
      if (!knownDemo.has(e.id)) await this.insertEntry(e);
    }

    this.seeded = true;
  }

  private async insertProblem(p: Problem): Promise<void> {
    await this.client.query(
      `insert into problems
         (id, slug, type, topic, category, difficulty,
          title_bn, title_en, statement_bn, statement_en,
          answer, solution_bn, solution_en, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (id) do nothing`,
      [
        p.id,
        p.slug,
        p.type,
        p.topic,
        p.category,
        p.difficulty,
        p.title.bn,
        p.title.en,
        p.statement.bn,
        p.statement.en,
        p.answer,
        p.solution.bn,
        p.solution.en,
        p.source
      ]
    );
  }

  async listProblems(f: ProblemFilters): Promise<Problem[]> {
    const where: string[] = [];
    const values: unknown[] = [];
    const push = (column: string, list: string[] | undefined) => {
      if (!list || !list.length) return;
      values.push(list);
      where.push(`${column} = any($${values.length}::text[])`);
    };
    push("type", f.types);
    push("topic", f.topics);
    push("category", f.categories);
    push("difficulty", f.difficulties);

    const res = await this.client.query(
      `select id, slug, type, topic, category, difficulty,
              title_bn, title_en, statement_bn, statement_en,
              answer, solution_bn, solution_en, source
       from problems
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by topic, difficulty, id`,
      values
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      type: String(r.type) as Problem["type"],
      topic: String(r.topic) as Problem["topic"],
      category: String(r.category) as Problem["category"],
      difficulty: String(r.difficulty) as Problem["difficulty"],
      title: { bn: String(r.title_bn), en: String(r.title_en) },
      statement: { bn: String(r.statement_bn), en: String(r.statement_en) },
      answer: String(r.answer),
      solution: { bn: String(r.solution_bn), en: String(r.solution_en) },
      source: String(r.source ?? "")
    }));
  }

  async saveProblem(p: Problem): Promise<void> {
    await this.client.query(
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
        p.title.bn,
        p.title.en,
        p.statement.bn,
        p.statement.en,
        p.answer,
        p.solution.bn,
        p.solution.en,
        p.source
      ]
    );
  }

  async deleteProblem(id: string): Promise<void> {
    await this.client.query("delete from problems where id = $1", [id]);
  }

  private async fetchTests(where: string, values: unknown[], limit: number): Promise<PracticeTest[]> {
    const res = await this.client.query(
      `select id, client_id, title, filters, problem_ids, duration_min, status,
              answers, score, max_score, correct_count, started_at, submitted_at,
              timed_out, scheduled_test_id, display_name, account_id
       from practice_tests
       ${where}
       order by created_at desc
       limit ${limit}`,
      values
    );
    return res.rows.map((r) => this.rowToTest(r));
  }

  private rowToTest(r: Record<string, unknown>): PracticeTest {
    return {
      id: String(r.id),
      clientId: String(r.client_id),
      title: String(r.title ?? ""),
      filters: (r.filters as PracticeTest["filters"]) ?? { ...EMPTY_FILTERS },
      problemIds: (r.problem_ids as string[]) ?? [],
      durationMin: Number(r.duration_min ?? 20),
      status: r.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
      answers: (r.answers as TestAnswer[]) ?? [],
      score: Number(r.score ?? 0),
      maxScore: Number(r.max_score ?? 0),
      correctCount: Number(r.correct_count ?? 0),
      startedAt: iso(r.started_at),
      submittedAt: r.submitted_at ? iso(r.submitted_at) : undefined,
      timedOut: Boolean(r.timed_out),
      origin: "cloud",
      scheduledTestId: r.scheduled_test_id ? String(r.scheduled_test_id) : undefined,
      displayName: r.display_name ? String(r.display_name) : undefined,
      accountId: r.account_id ? String(r.account_id) : undefined
    };
  }

  async listTests(clientId: string): Promise<PracticeTest[]> {
    return this.fetchTests("where client_id = $1", [clientId], 200);
  }

  private async insertEntry(t: PracticeTest): Promise<void> {
    await this.client.query(
      `insert into practice_tests
         (id, client_id, title, filters, problem_ids, duration_min, status,
          answers, score, max_score, correct_count, started_at, submitted_at,
          timed_out, scheduled_test_id, display_name, account_id)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (id) do nothing`,
      [
        t.id,
        t.clientId,
        t.title,
        JSON.stringify(t.filters ?? EMPTY_FILTERS),
        JSON.stringify(t.problemIds ?? []),
        Math.max(1, Math.min(240, Math.round(t.durationMin || 20))),
        t.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
        JSON.stringify(t.answers ?? []),
        Math.round(t.score || 0),
        Math.round(t.maxScore || 0),
        Math.round(t.correctCount || 0),
        t.startedAt || new Date().toISOString(),
        t.submittedAt ?? null,
        Boolean(t.timedOut),
        t.scheduledTestId ?? null,
        t.displayName ?? null,
        t.accountId ?? null
      ]
    );
  }

  async saveTest(t: PracticeTest): Promise<void> {
    await this.client.query(
      `insert into practice_tests
         (id, client_id, title, filters, problem_ids, duration_min, status,
          answers, score, max_score, correct_count, started_at, submitted_at,
          timed_out, scheduled_test_id, display_name, account_id)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17)
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
         timed_out = excluded.timed_out,
         scheduled_test_id = excluded.scheduled_test_id,
         display_name = excluded.display_name,
         account_id = excluded.account_id`,
      [
        t.id,
        t.clientId,
        t.title,
        JSON.stringify(t.filters ?? EMPTY_FILTERS),
        JSON.stringify(t.problemIds ?? []),
        Math.max(1, Math.min(240, Math.round(t.durationMin || 20))),
        t.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
        JSON.stringify(t.answers ?? []),
        Math.round(t.score || 0),
        Math.round(t.maxScore || 0),
        Math.round(t.correctCount || 0),
        t.startedAt || new Date().toISOString(),
        t.submittedAt ?? null,
        Boolean(t.timedOut),
        t.scheduledTestId ?? null,
        t.displayName ?? null,
        t.accountId ?? null
      ]
    );
  }

  async deleteTest(id: string, clientId: string): Promise<void> {
    // Scoped by client_id so one learner can never delete another's paper.
    await this.client.query("delete from practice_tests where id = $1 and client_id = $2", [id, clientId]);
  }

  async listScheduled(includeUnpublished: boolean): Promise<ScheduledTest[]> {
    const res = await this.client.query(
      `select id, kind, title_bn, title_en, description_bn, description_en,
              start_at, end_at, duration_min, problem_ids, published
       from scheduled_tests
       ${includeUnpublished ? "" : "where published = true"}
       order by start_at desc`
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      kind: (String(r.kind) || "CUSTOM") as ScheduledTest["kind"],
      title: { bn: String(r.title_bn), en: String(r.title_en) },
      description: { bn: String(r.description_bn ?? ""), en: String(r.description_en ?? "") },
      startAt: iso(r.start_at),
      endAt: iso(r.end_at),
      durationMin: Number(r.duration_min ?? 45),
      problemIds: (r.problem_ids as string[]) ?? [],
      published: Boolean(r.published)
    }));
  }

  async saveScheduled(t: ScheduledTest): Promise<void> {
    await this.client.query(
      `insert into scheduled_tests
         (id, kind, title_bn, title_en, description_bn, description_en,
          start_at, end_at, duration_min, problem_ids, published)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       on conflict (id) do update set
         kind = excluded.kind,
         title_bn = excluded.title_bn, title_en = excluded.title_en,
         description_bn = excluded.description_bn, description_en = excluded.description_en,
         start_at = excluded.start_at, end_at = excluded.end_at,
         duration_min = excluded.duration_min,
         problem_ids = excluded.problem_ids,
         published = excluded.published`,
      [
        t.id,
        t.kind,
        t.title.bn,
        t.title.en,
        t.description.bn,
        t.description.en,
        t.startAt,
        t.endAt,
        Math.max(1, Math.min(24 * 60, Math.round(t.durationMin || 45))),
        JSON.stringify(t.problemIds ?? []),
        Boolean(t.published)
      ]
    );
  }

  async deleteScheduled(id: string): Promise<void> {
    await this.client.query("delete from scheduled_tests where id = $1", [id]);
  }

  private rowToUser(r: Record<string, unknown>): StoredUser {
    return {
      id: String(r.id),
      username: String(r.username),
      displayName: String(r.display_name),
      email: r.email ? String(r.email) : undefined,
      phone: r.phone ? String(r.phone) : undefined,
      passwordHash: String(r.password_hash),
      createdAt: iso(r.created_at)
    };
  }

  private static readonly USER_COLS = "id, username, display_name, email, phone, password_hash, created_at";

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    const res = await this.client.query(
      `select ${PgStore.USER_COLS} from users where username = $1`,
      [username]
    );
    return res.rows[0] ? this.rowToUser(res.rows[0]) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const res = await this.client.query(
      `select ${PgStore.USER_COLS} from users where id = $1`,
      [id]
    );
    return res.rows[0] ? this.rowToUser(res.rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const res = await this.client.query(
      `select ${PgStore.USER_COLS} from users where lower(email) = lower($1)`,
      [email]
    );
    return res.rows[0] ? this.rowToUser(res.rows[0]) : null;
  }

  async createUser(user: StoredUser): Promise<boolean> {
    const res = await this.client.query(
      `insert into users (id, username, display_name, email, phone, password_hash, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (username) do nothing`,
      [
        user.id,
        user.username,
        user.displayName,
        user.email ?? null,
        user.phone ?? null,
        user.passwordHash,
        user.createdAt
      ]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async setUserDisplayName(id: string, displayName: string): Promise<void> {
    await this.client.query("update users set display_name = $2 where id = $1", [id, displayName]);
  }

  async listEntries(): Promise<PracticeTest[]> {
    return this.fetchTests(
      "where scheduled_test_id is not null and status = 'SUBMITTED'",
      [],
      5000
    );
  }

  async overview(): Promise<StoreOverview> {
    const [p, t, s, l, a] = await Promise.all([
      this.client.query("select count(*)::int as n from problems"),
      this.client.query("select count(*)::int as n from scheduled_tests"),
      this.client.query(
        "select count(*)::int as n from practice_tests where scheduled_test_id is not null and status = 'SUBMITTED'"
      ),
      this.client.query(
        "select count(distinct client_id)::int as n from practice_tests where scheduled_test_id is not null and status = 'SUBMITTED'"
      ),
      this.client.query("select count(*)::int as n from users")
    ]);
    return {
      problems: Number(p.rows[0]?.n ?? 0),
      tests: Number(t.rows[0]?.n ?? 0),
      submissions: Number(s.rows[0]?.n ?? 0),
      learners: Number(l.rows[0]?.n ?? 0),
      accounts: Number(a.rows[0]?.n ?? 0)
    };
  }
}

/* ------------------------------------------------------------------ */
/* File (JSON) store                                                   */
/* ------------------------------------------------------------------ */

interface FileShape {
  problems: Problem[];
  tests: PracticeTest[];
  scheduled: ScheduledTest[];
  users: StoredUser[];
}

/** Fresh arrays every call — the shape must never share mutable references. */
function emptyFile(): FileShape {
  return { problems: [], tests: [], scheduled: [], users: [] };
}

export class FileStore implements Store {
  readonly label = "file" as const;
  /** Rewritten when the preferred file is read-only and we fall back to tmp. */
  detail: string;
  private file: string;
  private data: FileShape;
  private seeded = false;

  constructor(preferred: string) {
    this.file = preferred;
    this.detail = preferred;
    this.data = this.read(preferred);
  }

  private read(file: string): FileShape {
    try {
      if (existsSync(file)) {
        const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<FileShape>;
        return {
          problems: Array.isArray(parsed.problems) ? parsed.problems : [],
          tests: Array.isArray(parsed.tests) ? parsed.tests : [],
          scheduled: Array.isArray(parsed.scheduled) ? parsed.scheduled : [],
          // Stores written before accounts existed simply start with none.
          users: Array.isArray(parsed.users) ? parsed.users : []
        };
      }
    } catch {
      /* corrupt file — start clean rather than crash */
    }
    return emptyFile();
  }

  private persist(): void {
    const write = (file: string) => {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(this.data));
    };
    try {
      write(this.file);
    } catch {
      // Not writable (read-only deploy) — fall back to the temp directory.
      try {
        const alt = join(tmpdir(), "gonit-ishkul-store.json");
        write(alt);
        this.file = alt;
        this.detail = alt;
      } catch {
        /* in-memory only */
      }
    }
  }

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    let changed = false;

    const known = new Set(this.data.problems.map((p) => p.id));
    for (const p of PROBLEMS) {
      if (!known.has(p.id)) {
        this.data.problems.push(p);
        changed = true;
      }
    }

    const knownTests = new Set(this.data.scheduled.map((t) => t.id));
    const claimed = this.data.scheduled.flatMap((t) => t.problemIds);
    const papers = seedPapers(Date.now(), claimed);
    for (const t of papers) {
      if (!knownTests.has(t.id)) {
        this.data.scheduled.push(t);
        changed = true;
      }
    }

    const knownDemo = new Set(this.data.tests.map((t) => t.id));
    for (const e of seedEntries(papers)) {
      if (!knownDemo.has(e.id)) {
        this.data.tests.push(e);
        changed = true;
      }
    }

    // Drop windows that ended long ago so the document stays bounded.
    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const before = this.data.tests.length;
    this.data.tests = this.data.tests.filter(
      (t) => !t.scheduledTestId || Date.parse(t.submittedAt ?? t.startedAt) >= cutoff
    );
    if (this.data.tests.length !== before) changed = true;

    if (changed) this.persist();
    this.seeded = true;
  }

  async listProblems(f: ProblemFilters): Promise<Problem[]> {
    return filterProblemsJS(this.data.problems, f);
  }

  async saveProblem(p: Problem): Promise<void> {
    const idx = this.data.problems.findIndex((x) => x.id === p.id);
    if (idx >= 0) this.data.problems[idx] = p;
    else this.data.problems.push(p);
    this.persist();
  }

  async deleteProblem(id: string): Promise<void> {
    const before = this.data.problems.length;
    this.data.problems = this.data.problems.filter((p) => p.id !== id);
    if (this.data.problems.length !== before) this.persist();
  }

  async listTests(clientId: string): Promise<PracticeTest[]> {
    return this.data.tests
      .filter((t) => t.clientId === clientId)
      .slice(0, 200)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async saveTest(t: PracticeTest): Promise<void> {
    const idx = this.data.tests.findIndex((x) => x.id === t.id);
    if (idx >= 0) this.data.tests[idx] = t;
    else this.data.tests.unshift(t);
    this.persist();
  }

  async deleteTest(id: string, clientId: string): Promise<void> {
    const before = this.data.tests.length;
    this.data.tests = this.data.tests.filter((t) => !(t.id === id && t.clientId === clientId));
    if (this.data.tests.length !== before) this.persist();
  }

  async findUserByUsername(username: string): Promise<StoredUser | null> {
    return this.data.users.find((u) => u.username === username) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.data.users.find((u) => u.id === id) ?? null;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const needle = email.trim().toLowerCase();
    return this.data.users.find((u) => (u.email ?? "").trim().toLowerCase() === needle) ?? null;
  }

  async createUser(user: StoredUser): Promise<boolean> {
    if (this.data.users.some((u) => u.username === user.username)) return false;
    if (user.email && this.data.users.some((u) => (u.email ?? "").toLowerCase() === user.email!.toLowerCase())) {
      return false;
    }
    this.data.users.push(user);
    this.persist();
    return true;
  }

  async setUserDisplayName(id: string, displayName: string): Promise<void> {
    const user = this.data.users.find((u) => u.id === id);
    if (!user || user.displayName === displayName) return;
    user.displayName = displayName;
    this.persist();
  }

  async listScheduled(includeUnpublished: boolean): Promise<ScheduledTest[]> {
    return this.data.scheduled
      .filter((t) => includeUnpublished || t.published)
      .sort((a, b) => b.startAt.localeCompare(a.startAt));
  }

  async saveScheduled(t: ScheduledTest): Promise<void> {
    const idx = this.data.scheduled.findIndex((x) => x.id === t.id);
    if (idx >= 0) this.data.scheduled[idx] = t;
    else this.data.scheduled.push(t);
    this.persist();
  }

  async deleteScheduled(id: string): Promise<void> {
    const before = this.data.scheduled.length;
    this.data.scheduled = this.data.scheduled.filter((t) => t.id !== id);
    if (this.data.scheduled.length !== before) this.persist();
  }

  async listEntries(): Promise<PracticeTest[]> {
    return this.data.tests.filter((t) => Boolean(t.scheduledTestId) && t.status === "SUBMITTED");
  }

  async overview(): Promise<StoreOverview> {
    const entries = await this.listEntries();
    const learners = new Set(entries.map((e) => e.clientId));
    return {
      problems: this.data.problems.length,
      tests: this.data.scheduled.length,
      submissions: entries.length,
      learners: learners.size,
      accounts: this.data.users.length
    };
  }
}

/* ------------------------------------------------------------------ */
/* Store resolution                                                    */
/* ------------------------------------------------------------------ */

let storePromise: Promise<Store> | null = null;

/**
 * The best store available: Postgres when a connection opens, otherwise the
 * JSON file. `STORE=file` forces the file path (used by `npm run dev:api`).
 */
export function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = (async () => {
      const preferred = process.env.STORE_FILE || join(process.cwd(), ".data", "store.json");

      if (process.env.STORE !== "file") {
        const conn = await connectPg();
        if (conn) {
          const store = new PgStore(conn.client, conn.label);
          await store.ensureSeeded();
          return store;
        }
      }

      const store = new FileStore(preferred);
      await store.ensureSeeded();
      return store;
    })();
  }
  return storePromise;
}

/** Small in-process cache so repeated calls don't re-seed. */
export async function readyStore(): Promise<Store> {
  const store = await getStore();
  await store.ensureSeeded();
  return store;
}
