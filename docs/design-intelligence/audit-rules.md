# Audit rules V1

Two layers:
- **A. Automatic** (`tools/design-audit.mjs`): measurable facts, flagged 🔴 or 🟡.
- **B. Vision review** ([vision-review.md](vision-review.md)): judgement calls on the screenshots.

A flag means "look here". It is never a design verdict on its own.

## A. Automatic checks

**How the numbers were calibrated:**
- **Reference pages:** the same measurements on the 18 reference sites (home and article, 1440 and 390, captured
  2026-10-17).
- **MarkLens failures:** the mid-review findings.

**When to re-calibrate:** if the reference set changes, re-run it and revisit this table. The `T` object at the
top of the script is the only place thresholds live.

| Check | Flag | Threshold | Why this number |
|---|---|---|---|
| Broken images (loaded, 0 natural width) | 🔴 | any | Never acceptable |
| Horizontal overflow | 🔴 | page wider than viewport | Never acceptable |
| `/_next/image` requests | 🔴 | any | MarkLens-specific: Vercel image optimization is off on purpose (F8). On other sites it only means they use it. |
| Console errors / exceptions | 🔴 | any | Never acceptable on MarkLens |
| Hangul in a mono font | 🟡 | any element whose first font is mono and whose text contains Hangul | Geist Mono has no Hangul (F5) |
| Text under 11px | 🟡 | any; 11–12px is counted but not flagged | 9 of 18 references have no text under 11px on the measured pages, and only 6 have 5 or more |
| Same photo used twice | 🟡 | 2+ visible uses of the same source (CDN wrapper and size ignored), with y positions | On article and detail pages, references repeat 0–1 times; homepages repeat more by design, so weigh it lower there |
| Cover crop | 🟡 | `object-fit: cover` removes 20%+ of the photo | Catches the DANGGEUN poster crop (25%). Many crops are fine; only look at photos with printed text, faces or products |
| As-of dates disagree | 🟡 | two or more different dates next to "Updated / 기준 / as of / Snapshot" on one page | Visual consistency only; factual correctness is Content QA |
| Missing alt | 🟡 | any `<img>` without an `alt` attribute | Accessibility |
| Large blank band | 🟡 | over 240px (1440) or 180px (390) with no text or media | Reference median 160 / 175px. References' biggest bands are usually ad slots, so a flag here means "look". |
| Long page | 🟡 | over 10 screens (1440) or 14 screens (390) | About the reference article median: 9.2 / 13.1 screens. Long is not bad by itself. |
| Busy first screen | 🟡 | over 40 text blocks, or over 5 standalone numbers, or over 20 short uppercase/mono labels | References peak at 5 standalone numbers (The Verge article). MarkLens Home has 11 and the Index 8. |
| Rounded cards | 🟡 | over 12 boxes with radius ≥12px plus shadow or fill | Every reference page measured 0–4 |
| Glass / gradient chrome | 🟡 | any `backdrop-filter`, or more than 3 gradient backgrounds over 100px wide | N1. Some references show gradients in dotted rules or ads, so check what the element is. |

**Also measured, not flagged** (in each page's JSON):
- headline size and family
- the sans / serif / mono character share
- body size
- uppercase label count
- first-screen image share
- a dark/light rhythm string down the page (for example `LDLDLD`)

**Known limits**
- **Font classes:** fonts are classified by the first name in the stack, then by the generic fallback. A custom serif
  with a `sans-serif` fallback reads as sans; Semafor's article measured 100% sans although it is visibly serif.
  Confirm serif/sans on the screenshot.
- **Rhythm string:** it samples the background colour behind the page centre every 400px. Colour fields inside
  cards (The Pudding, Stripe Press) read as alternation.
- **Overlays:** consent, paywall and newsletter layers distort reference measurements. The research pass removed
  them in a scratch copy; the repo tool leaves pages as they are.

## B. Vision review (judgement)

These questions are answered from the screenshots with [vision-review.md](vision-review.md):
- AI-dashboard feel
- SaaS feel
- premium editorial
- hero clarity
- hierarchy
- brand differentiation
- Pattern impact
- crop quality (is printed text or a face cut?)
- rhythm
- mobile fatigue
- noticeable repetition

## Validation against the mid-review findings

The 12 things the mid-review (`c2e4898`) said Design Intelligence must catch, re-run on the same build.

**Run used:** the final run used the finished tool. The "Vision review" column was done by reading the captured
screenshots with the vision-review questions.

| # | Mid-review finding | Automatic? | Result in this run |
|---|---|---|---|
| 1 | Korean in mono | ✅ auto | Found on Insight detail ("브랜딩", "목차") and Home ("브랜딩", "퍼포먼스"). Also found a case the mid-review missed: the dossier "기준" line. |
| 2 | Text under 12px | ✅ auto | Home 60 elements under 11px (9px desktop, **8px** mobile), Insights list mobile 46, dossiers 10–14 at 1440. The site footer is 10px on every page. |
| 3 | Same image repeated | ✅ auto | Dossiers 1–4 repeats, with y positions showing Key Moves → Pattern (and DANGGEUN Pattern → Timeline). |
| 4 | Crop cuts printed text | ◐ auto flag + eyes | The script flags the crop (DANGGEUN 25%, TOSS 38%, Home sample 43%). Only the screenshot shows whether letters are cut ("당근 광고 MCP"). |
| 5 | Hero carries too much UI | ◐ auto flag + eyes | Flags Home (56 / 11 / 14) and Index (47 / 8 / 15); does not flag the simplified dossier hero (25 / 3 / 10). Whether the hero is clear is a vision call. |
| 6 | Section gaps | ◐ auto numbers + eyes | Gives the largest gaps (dossiers 158–200px desktop). It does not name the sections, and "uniform" is a judgement. |
| 7 | Mobile page too long | ✅ auto | OLIVE YOUNG 9,401px = 11.1 screens, under the 14-screen line. The script measures; the vision review explains the problem is the small-text tail, not the length. |
| 8 | Brand differentiation | ✗ hard | No reliable metric. The vision review with names and logos covered says "same template". Treat it as a human decision. |
| 9 | AI-dashboard feel | ◐ proxies + eyes | Proxies: first-screen numbers and labels, rounded cards, glass/gradient. They point at Home and Index. The feel itself is a vision call. |
| 10 | Pattern looks small | ◐ eyes | Visible in the 1440 full screenshot. The script cannot isolate one section without a selector. |
| 11 | Dates disagree | ✅ auto (visual) | MUSINSA, OLIVE YOUNG and DANGGEUN each show "Updated" against a different "기준". Whether either date is right: Content QA. |
| 12 | `/_next/image` | ✅ auto | 0 requests on all 18 captures |

**Tally:**
- **6 automatic:** #1, #2, #3, #7, #11, #12.
- **5 need the screenshot,** with an automatic hint for 4 of them: #4, #5, #6, #9, #10.
- **1 is hard to detect** reliably: #8, brand differentiation.
- **Out of scope:** factual date correctness belongs to Content QA.
