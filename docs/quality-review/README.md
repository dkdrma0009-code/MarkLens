# MarkLens Quality Review V1.1

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
| CONTENT-DATE-001 | 🟡 human / note | Shown date is the report date, but the movement's own text or image names other days (an announcement whose other days are later is a note) |
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
1. counts, and how many known or sample-only findings were not asked
2. whether there is a real problem
3. "내가 확인할 것" (the human queue, up to 5): each item has a title, the facts, why it matters and, for a choice,
   up to three options
4. what was not judged automatically, including whether a vision review is needed
5. what is fine
6. "실제 데이터에서 재확인 필요" (findings seen only on sample data)
7. "이미 알고 있는 문제" (known issues and their reasons)
8. known issues that did not appear this run
9. what to do next
10. details (with scope and status) and the list of checks, at the bottom

**`report.json`** is for tools. It holds:
- `runAt`, `mode`, `base`, `knownFile`
- `summary { red, yellow, green, accepted, sampleOnly }`
- `visionReview { required, status, files }`
- `sections[]` (area, name, status, detail, ms)
- `findings[]` (id, key, area, level, kind, scope, status, target, message, evidence, and question / reason / knownTitle when relevant)
- `humanQueue[]` (key, kind, level, ids, title, lines, why, options, recommendation)
- `reviewItems[]`: every item a person may need, with its status (OPEN / DEFERRED / ACKNOWLEDGED). `humanQueue` is
  the OPEN part, capped at 5.

`reviewItems` is what the Notion Review Hub sync reads ([docs/review-hub/README.md](../review-hub/README.md)). The
review itself never writes to Notion.

## Human queue (V1.1)

The queue holds only what is worth a person's time.

**Kinds** (internal; the report just shows the item):

| Kind | Meaning | Rules |
|---|---|---|
| DECISION | A direction only the owner can set | Date meaning (`CONTENT-DATE-001`), Snapshot refresh (`CONTENT-SNAPSHOT-001`), public brand without Snapshot |
| REVIEW | Needs eyes on the result; no automatic answer | Crop, repetition, dates on screen, blank space, long page, first-screen density, style, lineage review or stale |
| ACTION | The answer is clear; the fix is not done yet | Everything else, and every 🔴 |

**Order:** 🔴 first, then DECISION, then REVIEW, then ACTION. At most 5 items. Ties sort by a stable key, so the same
state gives the same queue.

**Grouping:**
- Each date or Snapshot question stays its own item, because each movement's date means something different.
- Page findings are grouped per rule into one item listing the pages.

**Never in the queue:**
- **"Should we run a review?"** Vision review is a status. `visionReview.required` is true when design files changed in
  the last commit or the working tree, and the report says "미실행" (not run) until a person does it.
- **Findings whose scope is not real** (see Scope below).
- **Accepted or deferred known issues.**

**Scope:**
- **REAL:** the Brand Watch launch dataset, and the site's own code (typography, layout, delivery). Code findings stay
  REAL whatever data rendered them.
- **LOCAL_SAMPLE:** content-dependent findings (which photo, crop, length, dates, Insights rows) on pages built from
  the local database. Pass `--insights-scope real` when that database holds real content. These findings are listed
  under "실제 데이터에서 재확인 필요" (recheck on real data).
- **TEST_FIXTURE:** findings from `file://` validation pages.

## Known issues

`docs/quality-review/known-issues.json` lists findings that should not be asked again (`--known` points elsewhere).
Statuses:
- **OPEN:** the default for anything not listed.
- **ACKNOWLEDGED:** seen and accepted as is.
- **DEFERRED:** real, to be fixed in a later step.
- **RESOLVED:** fixed. If it appears again it returns to the queue, marked as having reappeared.

**Rules:**
- An entry matches by rule id plus optional `target` / `detail` substrings.
- For small text, it matches only while every small text on the page is one of the listed `texts`. A new small text
  anywhere on that page brings the finding back.
- **A 🔴 finding is never suppressed.** Broken pages or images, leaks, failed tests or builds, `/_next/image` and broken
  lineage always show.
- Entries that did not fire this run are listed as candidates to mark RESOLVED.
- To ask again, delete the entry or set it to OPEN.

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
