# MarkLens Design Intelligence V1

A small system for answering one question before any design change: **is this change MarkLens, or is it just a trend?**

It is research plus checks. It does not redesign the site. Changes it finds are listed for a person to approve.

## How it works (V1, frozen)

```
REFERENCE → PATTERN → MARKLENS FIT → ADOPTION DECISION → IMPLEMENT → AUTOMATED AUDIT → VISION REVIEW → HUMAN APPROVAL
```

1. **Reference.** Capture real pages at 1440 and 390 with `tools/design-audit.mjs`, MarkLens and live sites alike.
   Every claim points to a screenshot or a measured number. Dribbble-style shots are not evidence.
2. **Pattern.** Something counts as a pattern only when it appears on several independent sites. The count is
   written as X/N ([patterns.md](patterns.md)), never as a percentage guess. A single reference is never copied.
3. **MarkLens fit.** Hold the pattern against the [Design Bible](design-bible.md): FIXED / FLEXIBLE / FORBIDDEN, and
   Editorial Authority → Signal → Frame.
4. **Adoption decision.** ADOPT / EXPERIMENT / HOLD / REJECT, with a one-line reason ([adoption-queue.md](adoption-queue.md)).
   Experiments run locally first and are compared before/after at the same widths.
5. **Implement.** In the existing components and styles; no parallel experimental code ships.
6. **Automated audit.** `tools/design-audit.mjs`: FAIL means broken, REVIEW means look ([audit-rules.md](audit-rules.md)).
7. **Vision review.** The judgement questions in [vision-review.md](vision-review.md), on the screenshots.
8. **Human approval.** Nothing public changes without the owner's approval.

Conclusions are not decided first. Generic SaaS patterns are out of scope.

## Change policy

V1 is frozen as of 2026-10-17. Seeing one new reference is not a reason to change the Bible, the patterns or the
thresholds. A change needs all three:
- repeated evidence across independent sites (or repeated false positives / misses in real audits)
- fit with the FIXED rules
- the owner's approval

Record the change and its evidence in the file it changes.

## Responsibilities

| Layer | Owns | Does not own |
|---|---|---|
| **Design Intelligence** (this folder, the audit tool) | Layout, hierarchy, typography, image presentation (size, crop, repetition), responsive experience, visual consistency, editorial quality | Whether anything shown is true |
| **Content QA** | Whether dates are right, whether a source supports its claim, whether a Movement is factual, whether a Pattern stands on its evidence, whether a Take overstates, whether a Snapshot is current | How it looks |
| **Functional QA** | Broken pages, auth, API, review commands, caching and revalidation, database behaviour (the test suite) | Visual judgement |
| **Release QA** | Build, migrations, environment variables, deployment, production smoke test | Design and content decisions |

Design Intelligence surfaces a DATE REVIEW when different dates are on screen; deciding what each date means, and
whether it is correct, belongs to Content QA. A FAIL in the audit (broken image, overflow, console error,
`/_next/image`) is also a Functional QA failure; the audit only reports it.

## Files

| File | What it holds |
|---|---|
| [references.md](references.md) | 19 live reference sites (2026-10), what was opened, what was blocked, per-site observations |
| [patterns.md](patterns.md) | Patterns seen across the references, with counts, trend strength and MarkLens fit |
| [design-bible.md](design-bible.md) | FIXED / FLEXIBLE / FORBIDDEN rules for MarkLens |
| [adoption-queue.md](adoption-queue.md) | ADOPT / EXPERIMENT / HOLD / REJECT queue |
| [baseline-2026-10.md](baseline-2026-10.md) | Current MarkLens review (🔴 / 🟡 / 🟢) and the 13 candidate issues re-checked |
| [audit-rules.md](audit-rules.md) | What the script checks, the thresholds and why, and how it did against the mid-review findings |
| [vision-review.md](vision-review.md) | Prompt for the judgement calls a script cannot make |

## Running the audit

The audit drives the locally installed Chrome over the DevTools protocol. It has no dependencies, is not part of the
site build, and never touches production.

```bash
# MarkLens: build and start locally first (never against production data)
node tools/design-audit.mjs --out .design-audit home=http://localhost:3000/ insight=http://localhost:3000/insights/<slug>

# Any page: name=url pairs; --widths defaults to 1440,390; --no-shots skips screenshots
node tools/design-audit.mjs --out .design-audit --widths 1440,390 atlantic=https://www.theatlantic.com/
```

- **On Windows**, pass `--out` as `C:/...` or as a relative path. A Git Bash path such as `/c/Users/...` is resolved
  by Node as `C:\c\Users\...`.
- **Chrome path:** set `CHROME_PATH` or `--chrome` if Chrome is not in the default Windows location.
- **Output:** per page and width, a JSON file, a first-screen PNG and a full-page PNG (up to 9,000px), plus `report.json`.
  The console prints each page's result (PASS / REVIEW / FAIL) and the checks that fired. `.design-audit/` is a
  scratch folder; do not commit it.

FAIL is reserved for objectively broken pages. REVIEW is a prompt to look, not a verdict. Then run
[vision-review.md](vision-review.md) on the screenshots. Levels and thresholds: [audit-rules.md](audit-rules.md).

## Boundary with Content QA

Design Intelligence only shows that different dates are **on screen**, as a DATE REVIEW. For example, "Updated
2026.10.16" next to "2026.10.08 기준" may be two different meanings, not an error.

Whether a date is **factually** right belongs to Content QA. That includes the MUSINSA On&Off start date, or whether a
Snapshot includes the latest Move. The same split applies to image rights, source accuracy and wording.

## Sample data

Home and Insights QA runs use 16 sample insights that share 8 images. Repetition and crop REVIEWs on those two pages
come from the sample data, not from the rules. Judge them on real content before acting.

## Version

V1, 2026-10-17. MarkLens baseline: `release/brand-watch-v1` at `c2e4898`, rendered locally with QA fixtures and sample insights.

V1.1, 2026-10-17:
- **Calibration:** PASS / REVIEW / FAIL levels. Crop, repetition, dates, length and font size report context and
  leave the judgement to the vision review or Content QA.
- **Fixes:** two baseline issues fixed: Hangul in mono, and the DANGGEUN poster crop.
- **Experiment:** the Pattern experiment B is local QA only. Results are in [audit-rules.md](audit-rules.md#v11-self-test-2026-10-17)
  and [adoption-queue.md](adoption-queue.md).

Pattern B′ adopted (`abc1371`). Small thumbnail crops became INFO unless a risk signal is present.

**V1 final (frozen), 2026-10-17:**
- **Fixes:** FACT labels from 10px to 11px. The OLIVE YOUNG City Log visual is shown whole (`fit: "contain"`).
- **Calibration:** none further. The review is in [audit-rules.md](audit-rules.md#v1-final-validation-2026-10-17).
