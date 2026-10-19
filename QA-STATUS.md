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

## ⏱ Update — 2026-10-19, 23:25 (learner accounts + design upgrade)

- **Learner accounts shipped**: `/login` (sign-in / create-account toggle + signed-in
  "my account" view for renaming), username+password only (no email). Passwords are
  scrypt-hashed (`scrypt$N$r$p$salt$hash`, params bounded on verify); the bearer is a
  30-day HMAC session (`kind: "learner"`) that can never open admin routes — and the
  admin token can never act as a learner. Signing in attaches the real name to
  contest entries and skips the name gate; anonymous practice is untouched, and an
  offline network keeps the cached session alive.
- **New API routes**: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`,
  `PUT /auth/profile`; `Store` gained `users` (Pg table + file-store array) and
  `overview()` now counts accounts (surfaced as a 5th admin tile).
- **Error codes**: `invalid_username`, `invalid_password`, `display_name_required`,
  `username_taken` (409), `bad_credentials` (401), `unauthorized` (401) — mapped to
  bilingual messages client-side, unknown usernames still run a dummy verify so
  timing doesn't leak existence.
- **Design upgrade** ("more elements"): Home gained a hero feature-chip row and a
  contests section with a **live top-3 podium** built from the same deterministic
  demo entries the boards use; Leaderboard promotes its top three onto a podium
  above the table; Footer is now brand + tagline + stat strip + three link columns
  (explore / compete / account) + a two-line bottom bar. `/login` ships with a
  maths-chip side panel ("why an account?").

**Re-verified after these changes:**

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ clean |
| Unit tests | `npx.cmd vitest run` | ✅ 67/67 (+12 new `userAuth` hashing/username/session-kind tests) |
| Production build | `npm.cmd run build` | ✅ 144 problems |
| Responsive layout | `npm.cmd run layout` | ✅ all pass (43+ across 8 routes incl. `/login`) |
| E2E smoke (offline) | `npm.cmd run smoke` | ✅ 46/46, **zero console errors** (+login journey, contests/podium/chips assertions) |
| API contract smoke | `npm.cmd run smoke:api` | ✅ 71/71 (+20 account checks: signup rules, dupes, login, kind separation, rename) |
| E2E smoke (API attached) | `npm.cmd run smoke:cloud` | ✅ 47/47 — full signup → navbar greeting → sign-out journey |

- ⚠️ Supabase Postgres still unreachable from this machine (IPv6-only host, pooler
  ports time out) — the Postgres path stays untested; the file store proves the
  contract (as before). Remaining `npm audit` advisories are dev-toolchain only
  (vitest/vite/tailwind majors deferred on purpose).

## ⏱ Update — 2026-10-19, 23:55 (retrowave theme + Prothom Alo co-brand)

- **Retrowave/synthwave theme**: Tailwind gained a `neon` ramp (pink/magenta/purple/
  violet/indigo/cyan/teal/yellow) and a `palo` brand red, plus keyframes
  (`gridflow`, `drift`, `dash`, `pulseGlow`, `scan`, `marquee`) and horizon/sky/
  sheen gradients. `index.css` adds a fixed "infinity-mirror" dark backdrop
  (two offset neon grids + violet/cyan glows), neon card/button/field treatments,
  the `.retro-horizon` rolling perspective floor, `.retro-scanlines`, `.neon-text`,
  and reduced-motion still freezes all of it.
- **Moving maths**: new decorative components — `FloatingMath` (seeded field of
  π ∑ √ ∫ θ Δ ∞ glyphs, each with its own bob timing), `MathPlots` (`SinePlot`
  self-drawing wave, `CurvePlot` parabola with pulsing markers, `OrbitRing`), and
  `PageDecor` (ambient glow + glyphs + grid floor behind page headers). Home gains
  a "Maths in motion" band; the hero, CTA panel and Login side panel are retrowave.
- **Co-branded header**: `BrandLockup` stacks the Prothom Alo mark above the Gonit
  Ishkul lockup with a neon hairline, and **renders no wordmark text** (both logos
  spell their names). The Prothom Alo SVG has a near-black wordmark, so a
  `prothom-alo-dark.svg` variant (white ink, brand red kept) is swapped in via
  `dark:` classes. Navbar is `h-24`; the mobile sheet offset follows.
- **Bigger landscape logo**: the square `Logo.png` (2250×2250) actually contains a
  1492×1016 wordmark floating in transparent margins — cropping to the opaque
  bounds (+24 px pad) produced `public/logo-landscape.png` (1565×1065, ratio 1.47,
  84 KB). The navbar now paints a genuinely wide mark (79×54 desktop vs the old
  36×36 square) at a higher position in the hierarchy.
- **Prothom Alo credit**: hero chip linking to
  `prothomalo.com/collection/math-school`, a footer partnership line, and a
  brand-red footer badge. `index.html` gains co-brand meta + `/slogan.png` OG image.
- **Netlify**: `netlify.toml` now caches `/prothom-alo.svg`, `/prothom-alo-dark.svg`,
  `/slogan*.png`, `/gonit-bhaiya.jpeg` and `/assets/*` immutably.

**Re-verified after these changes:**

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ clean |
| Unit tests | `npx.cmd vitest run` | ✅ 67/67 |
| Production build | `npm.cmd run build` | ✅ 144 problems, all brand assets in `dist/` |
| Responsive layout | `npm.cmd run layout` | ✅ all pass (+2 checks/route: lockup paints, Gonit mark is landscape, Prothom Alo stacked above it) |
| E2E smoke (offline) | `npm.cmd run smoke` | ✅ 53/53, **zero console errors** (+7 co-brand/theme checks) |
| API contract smoke | `npm.cmd run smoke:api` | ✅ 71/71 |
| E2E smoke (API attached) | `npm.cmd run smoke:cloud` | ✅ 54/54 |

- ⚠️ Visual QA stays programmatic (the model cannot view images); the brand checks
  assert geometry (painted size, landscape ratio, stacking order) rather than looks.

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
- `src/lib/i18n.tsx` (23:40) — new-copy fixes: `admin.f.statementBn/En` "শর্ট"→"প্রশ্ন"
  (not a word); `auth.signin.sub` calque "নাম বহন করতে"→"নাম দেখাতে"; `auth.signup.sub`
  "প্রতিযোগিতার নাম" (read as *the contest's name*)→"ডিসপ্লে নাম" (matches the field);
  `home.competeBoardD` missing head noun → "…সমাধান করা সমস্যা".
- `src/lib/i18n.tsx` (23:45) — 4 new keys for wrong-reuse fixes below: `tests.empty`,
  `lb.hint`, `admin.problems.invalid`, `admin.f.draft`.
- `src/pages/Tests.tsx` (23:45) — empty-calendar state now says "No scheduled tests"
  (`tests.empty`), not the submissions-flavoured `lb.empty`.
- `src/pages/Leaderboard.tsx` (23:45) — bottom hint is `lb.hint` (solved-count rank,
  tie-breaks) — was `tests.standings.hint` ("Score decides rank"), contradicting the
  page's own `lb.intro`.
- `src/pages/Admin.tsx` (23:45) — problem editor error now `admin.problems.invalid`
  (ID/titles/statements/answer) — was `admin.tests.invalid` (mentioned times +
  paper problems); unpublished test chip now reads "Draft"/খসড়া — it rendered
  "Published"/প্রকাশিত on unpublished tests.

## Resolved

- ~~`src/pages/About.tsx` GitHub link placeholder~~ — the About page was removed
  entirely (page, route, nav/footer links, i18n keys, script routes). `/about`
  now falls through to the 404 page; `scripts/smoke.mjs` asserts this.

Remaining work, if any, is yours to define — everything verifiable is passing.
