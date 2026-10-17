# MarkLens Quality Review V1

One local command that runs the Design, Content and Functional checks together and tells a person three things:
- whether there is a real problem
- what needs their decision
- what is fine

It does not approve anything.

```
IMPLEMENT → AUTOMATED CHECK → CONTENT CHECK → DESIGN CHECK → FUNCTIONAL CHECK → HUMAN REVIEW → FIX → RECHECK → APPROVE
```

## Run it

Use a local build only. The command refuses to read a non-local site or database.

```bash
# Local server first (dummy keys; the database URL must be local, for example the QA stand-in)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 npx next start -p 3000

# Quick (about 2–3 minutes): Content QA, all tests, page status, design audit, cache settings of the last build
PGLITE_MODULE=<path to @electric-sql/pglite> NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 \
  node tools/quality-review.mjs --base http://localhost:3000

# Full: also TypeScript, ESLint and a production build (restart the server afterwards to serve the new build)
… node tools/quality-review.mjs --full --base http://localhost:3000
```

**Options:**
- **No `--base`:** pages and design are skipped and say so.
- **`--brand-route` / `--brands-index`:** point the brand pages elsewhere. The local QA routes are
  `--brand-route /qa-bw-public/launch-{slug} --brands-index /qa-bw-public/launch-index`.
- **`--out`:** where the report goes. The default `.quality-review/` is git-ignored.

**Exit code:** 1 when anything is 🔴, otherwise 0.

## What runs

| Area | Check | Source | Notes |
|---|---|---|---|
| Content | Brand Watch structure | The real launch dataset seeded into PGlite, read through the real public read model and lineage-health code | [content-review.md](content-review.md) |
| Content | Insights structure | The local PostgREST database (`NEXT_PUBLIC_SUPABASE_URL`, local only) | Only the fields the public pages select |
| Design | Automatic screen checks at 1440 and 390 | `tools/design-audit.mjs` | Rules and thresholds: [design-intelligence/audit-rules.md](../design-intelligence/audit-rules.md) |
| Design | Judgement (dashboard feel, editorial quality, hierarchy, Pattern impact, brand difference, crop quality, mobile fatigue) | A person with the screenshots in `.quality-review/design/` | [design-intelligence/vision-review.md](../design-intelligence/vision-review.md) |
| Functional | The existing test suite, grouped (Brand Watch flow, admin and review commands, public pages and data protection, caching and revalidation, images, Quality Review, other) | `node --test` | No new framework; the existing tests are called and their results collected |
| Functional | Page status: Home, Insights, one Insight, Brand Watch index, five brands | HTTP 200 on the local server | |
| Functional | Browser: broken images, `/_next/image`, double image proxy, console errors, overflow | `tools/design-audit.mjs` FAIL checks | |
| Functional | Cache settings: Home, Insights and Brand Watch 6h, Insight detail 24h | `.next/prerender-manifest.json` | Quick reads the last build, full the new one |
| Functional | TypeScript, ESLint, production build | `--full` only | The build runs only against a local database |

A check that fails does not stop the others. A check that cannot run is listed under "실행하지 못한 검사" (checks that
could not run), with the reason.

## Result levels

| Shown | Comes from | Meaning |
|---|---|---|
| 🔴 꼭 수정 | Design audit FAIL; lineage BROKEN; a public leak; a failed test, type check, lint error, build, page status or cache setting | Something is objectively broken |
| 🟡 확인 필요 | Design audit REVIEW; lineage REVIEW_REQUIRED or STALE; a date meaning or a stale Snapshot; missing optional content | A person should look; it may be fine |
| 🟢 괜찮음 | A check that ran clean; informational notes | Nothing to do |

Uncertain visual or content judgements are always 🟡, never 🔴. Page-level design findings are grouped per rule (one
line, many pages), so a site-wide issue does not become twenty warnings.

## Rule ids (V1)

| Id | Level | What |
|---|---|---|
| CONTENT-LEAK-001 | 🔴 | A field or internal value outside the public read model |
| CONTENT-LEAK-002 | 🔴 | A public fact whose Evidence is not approved and active |
| CONTENT-MOVEMENT-001 / 002 | 🔴 / 🟡 | Empty title, summary or evidence / no date |
| CONTENT-DATE-001 | 🟡 human | Shown date is the report date, but the movement's own text or image names other days |
| CONTENT-PATTERN-001 | 🔴 | Fewer than 2 distinct supporting movements, or a supporting movement that is not public |
| CONTENT-TAKE-001 | 🔴 | Take not tied to a public Pattern, or an empty part |
| CONTENT-SNAPSHOT-001 | 🟡 human | Snapshot as-of date is older than the latest public movement |
| CONTENT-SNAPSHOT-002 / 003 | 🟡 / 🔴 | Public brand without a Snapshot / Snapshot pointing at a Take that is not public |
| CONTENT-SOURCE-001 / 002 / 003 | 🔴 / 🟡 / note | Footnote missing URL, provider or title / duplicate source URL / collected source no evidence uses |
| CONTENT-LINEAGE-001 / 002 / 003 | 🔴 / 🟡 / 🟡 | Lineage health BROKEN / REVIEW_REQUIRED / STALE (existing evaluator, published objects) |
| INSIGHT-SLUG-001 | 🔴 | Two public Insights share a slug (or a legacy slug) |
| INSIGHT-CONTENT-001 / 002 | 🔴 / 🟡 | No title or category / no summary |
| INSIGHT-SOURCE-001 | 🟡 | No source URL or source name |
| INSIGHT-IMAGE-001 | 🟡 | No image, or a blocked image host without a fallback |
| DESIGN-TEXT-001 / 002 | 🟡 | Text under 11px / Hangul in a mono font |
| DESIGN-IMAGE-001 / 002 | 🟡 | Same photo shown large twice / crop worth checking |
| DESIGN-DATE-001 | 🟡 | Different dates on one screen (meaning: Content QA) |
| DESIGN-A11Y-001, SPACE-001, LENGTH-001, HERO-001, STYLE-001 | 🟡 | Missing alt, large blank band, long page, busy first screen, cards / glass / gradients |
| FUNC-IMAGE-001…004, FUNC-PAGE-001, FUNC-LAYOUT-001 | 🔴 | `/_next/image`, double proxy, broken image, image without source, console error, overflow |
| FUNC-TEST-001, TYPE-001, LINT-001, BUILD-001, ROUTE-001, CACHE-001 | 🔴 | Test, TypeScript, ESLint error, build, page status, cache setting |

New rules are added only when a real problem needs them.

## Report

**`report.md`** is for people. Its order:
1. counts
2. whether there is a real problem
3. "가장 먼저 볼 것" (what to look at first, up to 3)
4. "내가 확인할 것" (questions for you, up to 5)
5. what was not judged automatically
6. what is fine
7. what to do next
8. details and the list of checks, at the bottom

**`report.json`** is for tools. It holds:
- `runAt`, `mode`, `base`
- `summary { red, yellow, green }`
- `sections[]` (area, name, status, detail, ms)
- `findings[]` (id, area, level, target, message, review, and question / reason when a person must decide)
- `humanQueue[]` (id, target, question, reason)

`humanQueue` is the decision list a later integration (Notion, mail) would read; V1 only writes it.

## Who owns what

| Layer | Owns | Never decides |
|---|---|---|
| Design (Design Intelligence) | Layout, hierarchy, typography, image presentation, repetition, responsive experience, visual consistency | Whether content is true |
| Content QA | Structure and lineage automatically. Date meaning, source fidelity, Pattern logic, Take tone and Snapshot currency as questions for a person. | How it looks |
| Functional QA | Tests, types, lint, build, page status, caching and revalidation, image delivery | Whether a design is good |
| Release QA (separate, not in V1) | Migrations, environment, deployment, production smoke test | — |

Content QA never searches the web, guesses a date, rewrites a Pattern or Take, or adds interpretation. When it cannot
know, it says what needs checking.

## Validation (2026-10-17)

`tests/quality-review.test.mjs` runs with the test suite. The revalidation case was checked by hand.

| # | Known case | Expected | Result |
|---|---|---|---|
| 1 | Broken image | 🔴 FUNC-IMAGE-003 | Caught (design fixture) |
| 2 | Hangul in mono | 🟡 DESIGN-TEXT-002 | Caught (design fixture) |
| 3 | Text under 11px | 🟡 DESIGN-TEXT-001 | Caught (design fixture) |
| 4 | `/_next/image` | 🔴 FUNC-IMAGE-001 | Caught (design fixture) |
| 5 | Stale Snapshot (DANGGEUN 9.18 vs 10.10) | 🟡 CONTENT-SNAPSHOT-001, a question | Caught |
| 6 | Report date vs event date (MUSINSA On&Off) | 🟡 CONTENT-DATE-001, a question, not an error | Caught |
| 7 | No Snapshot on a private brand (BAEMIN, TOSS) | 🟢 no finding | Quiet |
| 8 | Movement without an image (TOSS) | 🟢 no finding | Quiet |
| 9 | Pattern with one supporting movement | 🔴 CONTENT-PATTERN-001 and CONTENT-LINEAGE-001 | Caught. The database also refuses this change to published lineage. |
| 10 | Rejected Evidence in a public movement | 🔴 CONTENT-LEAK-002 | Caught. The database also refuses to reset approved Evidence. |
| 11 | Internal field in public data | 🔴 CONTENT-LEAK-001 | Caught |
| 12 | Revalidation of every Insight page instead of the changed ones | 🔴 FUNC-TEST-001 (caching and revalidation) | Caught: 11 tests failed when the regression was injected; then restored |
| — | A clean page | 🟢 PASS | Quiet (design fixture) |
