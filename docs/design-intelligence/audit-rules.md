# Audit rules V1.1

Two layers:
- **A. Automatic** (`tools/design-audit.mjs`): measurable facts, reported as PASS, REVIEW or FAIL.
- **B. Vision review** ([vision-review.md](vision-review.md)): judgement calls on the screenshots.

**Result levels (V1.1):**
- **FAIL** is only for things that are objectively broken:
  - a broken image, or an image without a source
  - horizontal overflow
  - a console error
  - a `/_next/image` request
  - a double image proxy (the CDN wrapping itself)
- **REVIEW** means "a person or the vision review should look". Everything visual or editorial lands here: crop,
  repetition, dates, length, font size, density and decoration. REVIEW never blocks anything on its own.
- **PASS** means no check fired. A page result is FAIL if any FAIL fired, REVIEW if any REVIEW fired, and PASS otherwise.

## What V1.1 changed (calibration against false alarms)

| Check | V1 | V1.1 |
|---|---|---|
| Crop | 🟡 for any cover crop of 20% or more | Every crop of 20%+ is recorded with its section. It becomes **REVIEW** only with a reason: large (35%+), portrait or poster shape, or an alt text that describes text in the image. Whether letters, a face, a product or a logo is actually cut is decided by the vision review. |
| Repetition | 🟡 for any photo shown twice | Count, positions, section and width of every use are reported. **REVIEW** only when two or more uses are at least 200px wide (the same photo shown large twice). A small reference thumbnail is reported, not flagged. Whether the reuse is meaningless is decided by the vision review. |
| Dates | 🟡 "as-of dates disagree" | Reported as **DATE REVIEW**, with each label. "Updated", a Movement date and a Snapshot as-of can legitimately differ; Content QA decides what each date means and whether it is right. |
| Mobile length | 🟡 over 14 screens | Reports total px, screens, section count, repeated photos, and the text-only tail after the last image. **REVIEW** only when the page is over twice the reference article median, or over the median *and* ends in more than 2 screens of text. Otherwise the numbers are reported against the median (9.2 screens at 1440, 13.1 at 390). |
| Font size | 🟡 for any text under 11px, mixed together | Reported separately for **metadata** (short labels, under 40 characters) and **primary content** (40+ characters), per width. 12px+ is recommended, 11px is the minimum exception (counted), and under 11px is **REVIEW**. |

## A. Automatic checks

**How the numbers were calibrated:**
- **Reference pages:** the same measurements on the 18 reference sites (home and article, 1440 and 390, captured
  2026-10-17).
- **MarkLens failures:** the mid-review findings.

**When to re-calibrate:** if the reference set changes, re-run it and revisit this table. The `T` object at the
top of the script is the only place thresholds live.

| Check | Level | Threshold | Why this number |
|---|---|---|---|
| Broken images (has a source, loaded, 0 natural width) | FAIL | any | Never acceptable |
| Image without a source (`src` and `srcset` missing) | FAIL | any | A required image is missing |
| Horizontal overflow | FAIL | page wider than viewport | Never acceptable |
| `/_next/image` requests | FAIL | any | MarkLens-specific: Vercel image optimization is off on purpose (F8). On other sites it only means they use it. |
| Double image proxy | FAIL | any request with the CDN host twice in its URL | The loader must never wrap the CDN in itself |
| Console errors / exceptions | FAIL | any | Never acceptable on MarkLens |
| Hangul in a mono font | REVIEW | any element whose first font is mono and whose text contains Hangul | Geist Mono has no Hangul (F5) |
| Text under 11px | REVIEW | any, reported separately for metadata and primary content; 11px is counted as the minimum exception | 9 of 18 references have no text under 11px on the measured pages, and only 6 have 5 or more |
| Same photo shown large twice | REVIEW | 2+ uses at least 200px wide; every reuse is listed with section and width | On article and detail pages, references repeat 0–1 times; homepages repeat more by design, so weigh it lower there |
| Cover crop with a reason | REVIEW | `object-fit: cover` removes 20%+ **and** the crop is 35%+, the photo is portrait or poster-shaped, or its alt describes text, a face, a product or a logo | Catches the DANGGEUN poster crop (25%, alt quotes the poster text) without flagging ordinary photo crops |
| Thumbnail crop (under 160px wide) | INFO, or REVIEW with a risk signal | Crop share alone is recorded as INFO. REVIEW when the thumbnail is poster or document shaped, cut 45%+, or cut 35%+ while its alt describes text, a face, a product or a logo | A small reference cannot show printed text legibly anyway, but a thumbnail is not automatically safe either. Pattern reference thumbnails (25–29% crops) are INFO. |
| DATE REVIEW | REVIEW | two or more different dates next to "Updated / 기준 / as of / Snapshot" on one page | Different dates may be correct; Content QA decides |
| Missing alt | REVIEW | any `<img>` without an `alt` attribute | Accessibility |
| Large blank band | REVIEW | over 240px (1440) or 180px (390) with no text or media | Reference median 160 / 175px. References' biggest bands are usually ad slots, so a flag here means "look". |
| Long page | REVIEW | over 2× the reference article median, or over the median with a text-only tail of more than 2 screens | Medians 9.2 screens (1440) and 13.1 (390). Length alone is not a problem. |
| Busy first screen | REVIEW | over 40 text blocks, or over 5 standalone numbers, or over 20 short uppercase/mono labels | References peak at 5 standalone numbers (The Verge article). MarkLens Home has 11 and the Index 8. |
| Rounded cards | REVIEW | over 12 boxes with radius ≥12px plus shadow or fill | Every reference page measured 0–4 |
| Glass / gradient chrome | REVIEW | any `backdrop-filter`, or more than 3 gradient backgrounds over 100px wide | N1. Some references show gradients in dotted rules or ads, so check what the element is. |

**Also measured, not flagged** (in each page's JSON):
- headline size and family
- the sans / serif / mono character share
- body size
- uppercase label count
- first-screen image share
- a dark/light rhythm string down the page (for example `LDLDLD`)
- length context: section count and the text-only tail after the last image (px and screens)
- every cover crop of 20%+ with its section and reasons, and every reused photo with its sections and widths

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

## V1.1 self-test (2026-10-17)

The calibrated tool was run on the same pages before and after the two V1.1 fixes, and on the local-only Pattern
experiment B for BAEMIN.

| Check | Before | After |
|---|---|---|
| Hangul in mono | REVIEW on Home, Insight detail, MUSINSA, OLIVE YOUNG, DANGGEUN | No element left, on any page, at either width |
| DANGGEUN crop | REVIEW: two Key Move posters cropped 25%, both with text in the alt | No crop of 20%+ on the page. Both posters are shown whole (`fit: "contain"`). |
| BAEMIN Pattern repetition | A: 2 photos shown large twice (hero 652px → Pattern 607px; Key Moves 699px → Pattern 607px) → REVIEW | B: the same 2 photos reappear only as 88px references → reported, not flagged |
| BAEMIN length (screens) | A: 6.5 at 1440, 7.7 at 390 | B: 6.1 at 1440, 7.8 at 390 |
| FAIL checks | 0 on every page | 0 on every page |

**How the new rules behave on unchanged pages:**
- **Long page:** OLIVE YOUNG at 390 (11.1 screens, 7.5-screen text tail) stays PASS for length, because it is under
  the 13.1-screen reference median. The text-tail number remains visible for the vision review.
- **Crop:** the Home sample-data crops are REVIEW because they are large (39–45%), not because of text.
- **Dates:** MUSINSA, OLIVE YOUNG and DANGGEUN show DATE REVIEW, which leaves the decision to Content QA.
- **Repetition:** V1 skipped every image inside a `<header>`, which hid the dossier hero. V1.1 skips only site chrome
  (a header or footer outside the content). Hero → Pattern repeats now count: BAEMIN, MUSINSA and OLIVE YOUNG.
