# QA Status — all checks GREEN (for the main agent)

> Coordination note from the proofreading/ops agent. **No need to re-run these** —
> results below were produced against the current working tree. Delete this file
> when the project wraps up.

**Last full verification: 2026-10-19, ~19:20 (local)**

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ clean |
| Unit tests | `npm.cmd run test` | ✅ 23/23 (grading + filters) |
| Production build | `npm.cmd run build` | ✅ `tsc -b` + `vite build` + bank merge → 144 problems (24 per topic, 36 per difficulty) |
| Responsive layout | `node scripts/layout-check.mjs` | ✅ 25/25 (mobile/tablet/desktop × 4 routes + mobile menu) |
| E2E smoke | `node scripts/smoke.mjs` | ✅ 20/20, **zero console errors** (full journey: home → archive → filter deep-link → build test → run → results → past tests; plus assertions that the site is problem-solving themed and frames practice tests as one part) |
| Screenshots | `node scripts/screenshots.mjs` | ✅ PNGs in `screenshots/` (dark, light — About removed) |
| Dev server | `npm.cmd run dev` | ✅ http://localhost:5173, CSS compiles (Tailwind opacity scale 8/12/14 fixed), all routes + modules 200 |

## Proofreading already applied (no action needed)

- `src/data/problems-a.json`, `problems-b.json`, `problems-c.json` — all 144 answers math-verified; Bangla typos/mistranslations fixed (incl. `pr-h-02` title/statement/solution, সর্বশেষ, এংগেল, ক্যাটালান solution, compositions statement).
- `src/lib/i18n.tsx` — added `runner.notFound*`, `runner.answerKind*`, `notFound.body/action`, `past.statusSubmitted`.
- `src/pages/Results.tsx` — correct not-found copy; Skipped metric uses `Minus`, not `Trophy`.
- `src/pages/NotFound.tsx` — no longer reuses `filter.noneHint` as 404 body.
- `src/pages/PastTests.tsx` — status chip reads "Submitted", not "Your result".
- `tailwind.config.js` — `theme.extend.opacity: {8, 12, 14}` (fixes `@apply bg-accent-500/12` compile error).
- `vite.config.ts` — `@` alias; `public/logo.png` — favicon fixed.

## Resolved

- ~~`src/pages/About.tsx` GitHub link placeholder~~ — the About page was removed
  entirely (page, route, nav/footer links, i18n keys, script routes). `/about`
  now falls through to the 404 page; `scripts/smoke.mjs` asserts this.

Remaining work, if any, is yours to define — everything verifiable is passing.
