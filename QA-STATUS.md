# QA Status — all checks GREEN (for the main agent)

> Coordination note from the proofreading/ops agent. **No need to re-run these** —
> results below were produced against the current working tree. Delete this file
> when the project wraps up.

**Last full verification: 2026-10-19, ~21:30 (local)**

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ clean |
| Unit tests | `npm.cmd run test` | ✅ 55/55 (grading, filters, leaderboard maths, scheduled-test windows/seeds, admin auth) |
| Production build | `npm.cmd run build` | ✅ `tsc -b` + `vite build` + bank merge → 144 problems (24 per topic, 36 per difficulty) |
| Responsive layout | `npm.cmd run layout` | ✅ 43/43 (mobile/tablet/desktop × 7 routes incl. `/tests`, `/leaderboard`, `/admin` + mobile menu) |
| E2E smoke (offline fallback) | `npm.cmd run smoke` | ✅ 34/34, **zero console errors** (full journey + scheduled-tests calendar/countdown/standings toggle, leaderboard tabs/source, admin login gate) |
| API contract smoke | `npm.cmd run smoke:api` | ✅ 51/51 — real Netlify Function on plain Node, file store: learner reads/writes, standings, both leaderboard windows, admin login + auth gates + problem/paper CRUD, CORS, 404s |
| E2E smoke (API attached) | `npm.cmd run smoke:cloud` | ✅ 34/34, **zero console errors** — `dist-cloud` build with `VITE_API_BASE` → local API → same journey, proves the cloud-wins path |
| Screenshots | `node scripts/screenshots.mjs` | ✅ PNGs in `screenshots/` (dark, light — About removed) |
| Dev server | `npm.cmd run dev` | ✅ http://localhost:5173, CSS compiles (Tailwind opacity scale 8/12/14 fixed), all routes + modules 200 |
| Local API | `npm.cmd run dev:api` | ✅ http://localhost:8899/.netlify/functions/api (esbuild-bundled handler, `STORE=file`) |

## ⏱ Update — 2026-10-19, 20:15 (proofreading/ops agent)

- **Typecheck blocker fixed** in `src/lib/scheduled.ts` (your new file): line 221
  referenced `easyMedium`, which is defined nowhere → `weeklyPool.length ? weeklyPool : monthlyPool`
  (an EASY/MEDIUM fallback could never trigger there anyway, since it's a subset of `weeklyPool`).
- ⚠️ **Re-run typecheck when your standings/leaderboard edits to `src/lib/api.ts` settle.**
  At 20:13 it had 3 fresh errors that were absent at 20:09: `import.meta.env` (line 35,
  no vite/client type in scope) and the `markYou(rows, …)` `PeriodRow[]` vs `StandingsRow[]`
  mismatch (line 269). Left untouched on purpose — the file was 77 seconds old at the time.
- Proofreading batch applied at 20:08 (see list below): Bangla label/typo fixes,
  localized test titles, PastTests summary icons.

## ⏱ Update — 2026-10-19, 21:30 (feature batch: leaderboards, scheduled tests, admin)

- **New features shipped**: `/tests` (weekly/monthly calendar papers with phase
  countdowns, name gate, draft resume, per-paper standings deep-linkable via
  `?standings=`), `/leaderboard` (week/month/all tabs, problems-solved ranking,
  own-row highlight), `/admin` (id+password login → overview / problems CRUD /
  scheduled-test CRUD / submissions), filter-panel scrollbar.
- **Order normalisation**: `Tests.tsx` now sorts cards live → upcoming (soonest)
  → ended (newest), so cloud (newest-first) and offline (seed order) sources
  render identically.
- **Papers never repeat themselves**: `buildScheduledSeeds` tracks claimed
  problems (and both stores pass in ids already stored), so a rolled-forward
  week skips what past weeks tested; unit tests cover phase boundaries, seed
  identities/lengths, demo-entry determinism and `entryDeadline` clamping.
- **Two gates added**: `smoke:api` (51 checks, plain-Node handler + isolated
  file store) and `smoke:cloud` (UI journey against the attached API via a
  separate `dist-cloud` build). Local dev: `dev:api`.
- ⚠️ from the 20:15 note: the `import.meta.env` / `markYou` typecheck errors it
  reported are **resolved** — typecheck is clean as of this run.

## Proofreading already applied (no action needed)

- `src/data/problems-a.json`, `problems-b.json`, `problems-c.json` — all 144 answers math-verified; Bangla typos/mistranslations fixed (incl. `pr-h-02` title/statement/solution, সর্বশেষ, এংগেল, ক্যাটালান solution, compositions statement).
- `src/lib/i18n.tsx` — added `runner.notFound*`, `runner.answerKind*`, `notFound.body/action`, `past.statusSubmitted`.
- `src/pages/Results.tsx` — correct not-found copy; Skipped metric uses `Minus`, not `Trophy`.
- `src/pages/NotFound.tsx` — no longer reuses `filter.noneHint` as 404 body.
- `src/pages/PastTests.tsx` — status chip reads "Submitted", not "Your result".
- `tailwind.config.js` — `theme.extend.opacity: {8, 12, 14}` (fixes `@apply bg-accent-500/12` compile error).
- `vite.config.ts` — `@` alias; `public/logo.png` — favicon fixed.
- `src/lib/i18n.tsx` (20:08) — `filter.noneHint` বাংলা now says কঠিনতা (not ডিফিকাল্টি);
  `builder.randomSeed` → এলোমেলো করুন (verb, not noun শাফল); `past.totalCorrect` gets its
  object (সমাধান করা সমস্যা); `home.partsTestD` typo সমস্যানিয়ে → সমস্যা নিয়ে; `TOPIC_LABELS`
  বীজগাণিতিক/জ্যামিতিক → বীজগণিত/জ্যামিতি (noun forms — adjectives were wrong as chip labels).
- `src/data/types.ts` (20:08) — same বীজগণিত/জ্যামিতি fix in `TOPICS[].bn`.
- `src/pages/Practice.tsx` (20:08) — `buildTitle` now renders topics via `TOPIC_LABELS` +
  `L()` (test titles in Past Tests were hardcoded English, `void L`); English output unchanged.
- `src/pages/PastTests.tsx` (20:08) — summary icons: Best score `Check`→`Star`,
  Problems solved right `Clock`→`Check` (clock implied time on a correctness metric).

## Resolved

- ~~`src/pages/About.tsx` GitHub link placeholder~~ — the About page was removed
  entirely (page, route, nav/footer links, i18n keys, script routes). `/about`
  now falls through to the 404 page; `scripts/smoke.mjs` asserts this.

Remaining work, if any, is yours to define — everything verifiable is passing.
