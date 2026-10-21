# গণিত ইশকুল প্রবলেম সলভিং · Gonit Ishkul Problem Solving

The **official** bilingual (বাংলা / English) problem-solving platform of
*Prothom Alo's Gonit Ishkul* — built for Bangladeshi school and olympiad
students.

The site is problem-solving themed first: explore the **problem bank**, solve
problems and check them instantly, and read a full worked solution in Bangla or
English. **Practice tests** are one part of that — pick a **Type**, **Topic**,
**Category** and **Difficulty** → build a **timed paper** → get graded **the
instant you submit**. Every test is filed away under **Past Practice Tests** so
you can revisit your mistakes later.

---

## Features

| | |
|---|---|
| 🧮 **Problem archive** | 100+ auto-gradable problems, filterable by type / topic / category / difficulty, with an inline "check answer" box. |
| 🧪 **Practice test builder** | Auto-pick a balanced paper, or hand-pick problems one by one. Set the question count and the clock. |
| ⏱️ **Timed runner** | Live countdown, question grid, per-question navigation, and automatic submission when time runs out. |
| ✅ **Instant grading** | Forgiving answer parsing (`5,050`, `5050`, `2/4`, `0.5` all work), exact rational comparison, and a full solution for every problem. |
| 🕘 **Past practice tests** | Every paper is saved with its answers, score, grade band and review — synced to the cloud when available. |
| 🏆 **Leaderboard** | The problems-solved board for registered learners — week / month / all time, with your own row highlighted. |
| ⚔️ **Contest tab** | Weekly and monthly papers plus the contests your admin hands to you, with a live **contest rating** board (Elo-style points). |
| 🌗 **One clean edition** | A single light, printed-day edition — warm paper, serif headlines, Prothom Alo red. |
| 🌏 **Bangla + English** | Every string, problem statement and solution exists in both languages. |
| 📴 **Works offline** | The full bank ships with the site, so tests keep working with no network at all. |

### Taxonomy

- **Type** — Olympiad · Academics
- **Topic** — Number Theory · Algebra · Geometry · Combinatorics · Inequality · Probability
- **Category** — Primary (Class 3–5) · Junior (6–8) · Secondary (9–10) · Higher Secondary (11–12)
- **Difficulty** — Easy · Medium · Hard · Olympiad

---

## Tech stack

- **React 18 + Vite + TypeScript** — static-first SPA, deploys anywhere.
- **Tailwind CSS** — design system with a single light edition, on Prothom Alo's brand red.
- **KaTeX** — fast client-side maths rendering.
- **Netlify Functions** — a single serverless API (`/.netlify/functions/api`).
- **Supabase (PostgreSQL)** — stores the problem bank and your test history.

The app is **offline-first by design**: the bundled problem bank is the fallback,
and `localStorage` mirrors every test. When Supabase is reachable it becomes the
source of truth and the local copy acts as a cache — so nothing ever breaks.

---

## Project structure

```
├── netlify/
│   └── functions/
│       └── api.ts          # Serverless API: /problems, /tests, /health
├── public/                 # Logos & static assets
├── scripts/
│   ├── build-problem-bank.mjs   # Merges + validates the problem shards
│   └── verify-*.mjs             # Independent answer verification per shard
├── src/
│   ├── components/         # Navbar, Footer, FilterPanel, ProblemCard, MathText…
│   ├── data/
│   │   ├── types.ts        # Problem taxonomy + label vocabularies
│   │   ├── problems-a.json # Number Theory + Algebra
│   │   ├── problems-b.json # Geometry + Combinatorics
│   │   └── problems-c.json # Inequality + Probability
│   ├── lib/
│   │   ├── api.ts          # API client + graceful offline fallback
│   │   ├── contestRating.ts # Elo-style contest rating (contest tab)
│   │   ├── grading.ts      # Exact-rational answer parser & grader
│   │   ├── filters.ts      # Facet filtering + balanced problem picking
│   │   ├── i18n.tsx        # Bangla/English dictionary + provider
│   │   ├── storage.ts      # localStorage mirror + anonymous client id
│   └── pages/              # Home, Problems, Practice, Contests, TestRunner, Results…
└── netlify.toml
```

---

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

The site runs fully without a database. To exercise the Supabase path locally:

```bash
npm install -g netlify-cli
cp .env.example .env      # then fill in DATABASE_URL
netlify dev               # http://localhost:8888, functions included
```

### Checks

```bash
npm run typecheck         # TypeScript
npm test                  # Vitest — grader + filter logic
npm run db:verify         # Re-verify every problem answer by computation
```

---

## Deploying

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Gonit Ishkul Problem Solving"
git branch -M main
git remote add origin https://github.com/<you>/gonit-ishkul-problem-solving.git
git push -u origin main
```

### 2. Connect to Netlify

**Netlify → Add new site → Import an existing project → GitHub** and pick the
repo. `netlify.toml` supplies everything, so you can accept all the defaults:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

### 3. (Optional) Connect Supabase

The API works out of the box — on first request it creates the schema
(`problems`, `practice_tests`) and seeds the bundled bank into Supabase, then
serves your saved tests from there.

To point it at a different database, set one environment variable:

**Netlify → Site configuration → Environment variables → add**

```
DATABASE_URL = postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

> **Note on the password.** If your Supabase password contains an `@`, URL-encode
> it as `%40` inside the connection string.

If you prefer the connection pooler (recommended for serverless), use the
`aws-0-<region>.pooler.supabase.com:6543` host with the username
`postgres.<PROJECT_REF>` — the API already tries these automatically.

**Without any configuration the site still works completely** — problems come
from the bundled bank and tests are stored in the browser.

---

## Staff access (the admin dashboard)

The staff dashboard lives at **`/admin`** and opens with an **ID + password**
pair — not a learner account.

| | Default value | Environment variable |
| --- | --- | --- |
| Admin ID | `admin` | `ADMIN_ID` |
| Admin password | `gonit-ishkul` | `ADMIN_PASSWORD` |
| Session signing secret | derived from the password | `ADMIN_SECRET` (optional) |

The defaults keep a zero-config deployment usable, so the sign-in screen shows
them in a box of their own (see `.env.example`). Set `ADMIN_ID` and
`ADMIN_PASSWORD` in Netlify before going live — once they are overridden the
screen stops displaying the defaults and asks for the custom ones instead.

`ADMIN_SECRET` signs the 12-hour staff session token. Leave it unset and the
signature is derived from `ADMIN_PASSWORD`, so changing the password also
invalidates any staff session that is already open.

---

## Adding problems

Problems live in three JSON shards under `src/data/`. Add an object to the right
shard and the build does the rest:

```jsonc
{
  "id": "nt-m-07",                     // unique
  "slug": "sum-of-primes-below-30",    // unique, kebab-case
  "type": "ACADEMICS",                 // OLYMPIAD | ACADEMICS
  "topic": "NUMBER_THEORY",
  "category": "JUNIOR",
  "difficulty": "MEDIUM",
  "title": { "en": "…", "bn": "…" },
  "statement": { "en": "…$x^2$…", "bn": "…$x^2$…" },   // LaTeX in $…$
  "answer": "129",                     // integer, decimal, or "a/b"
  "solution": { "en": "…", "bn": "…" },
  "source": "BdMO Regional 2019"
}
```

`npm run build` validates every entry (unique ids, enums, bilingual fields,
numeric answers) and fails loudly on a mistake. `npm run db:verify`
independently recomputes the answers to catch wrong ones.

---

## Licence

Free to use for maths education. Problem solutions are written for learning;
please credit original sources where noted in each problem's `source` field.
