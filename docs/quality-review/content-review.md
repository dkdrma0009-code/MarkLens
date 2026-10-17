# Content QA V1

Content QA has two parts. Only the first is automatic.

## A. Structural (automatic)

**Brand Watch** (`tools/quality-review/content.mjs`):
- **Data:** the launch dataset (`src/lib/brand-watch/launch/`) is seeded into a local PGlite database with migrations
  018–022, at launch visibility (MUSINSA, OLIVE YOUNG and DANGGEUN public; TOSS and BAEMIN private).
- **Read path:** it is read through the same code the public pages use (`loadPublicBrandStates`).
- **Lineage:** it is judged by the existing lineage-health evaluator (`evaluateLineageHealth`), which already enforces:
  - the Pattern rule (at least `minIndependentMovements` = 2 independent movements)
  - rejected or corrected Evidence
  - cross-brand links
  - Snapshot coverage counts
  - freshness

Content QA adds only what those do not check:

| Object | Checked | Not checked |
|---|---|---|
| Source | Footnote has URL, provider and title; no duplicate URL; collected-but-unused sources listed as a note | Whether the source says what the Evidence claims |
| Evidence | Every public fact is approved and active (no rejected or superseded content leaks) | Whether the fact is true |
| Movement | Title, summary and evidence present; date present; report date vs dates in its own text | Which date the reader should see |
| Pattern | At least 2 distinct supporting movements, all public; lineage health | Whether the pattern is a sound reading |
| Take | Tied to a public Pattern; WHAT WE SEE / WHY IT MAY MATTER / WHAT TO WATCH NEXT all present | Whether it overstates |
| Snapshot | Public brands have one; it only points at public Takes; as-of date vs latest public movement | Whether it summarizes the brand well |
| Public model | Only allow-listed fields; no internal values | — |

**Policy points taken from the code, not invented:**
- **No Snapshot on a private brand is fine.** Private brands render nothing public, and the launch rationale is
  "No Snapshot".
- **Images are optional.** A movement without a visual is never a finding.
- **Dates are questions, not errors.** A report date shown while the text names an event date raises a question only.
  The rule compares explicit days only ("2026.10.06", "10월 19일"); a bare "19일" is too ambiguous.
- **Stale Snapshots are questions too.** A Snapshot older than a newer public movement is raised for a person, never
  updated automatically.

**Insights** use the local PostgREST database and only the fields the public pages select:
- `slug`, `legacy_slug`, `hook`, `summary`, `category`
- the article's `title`, `source_name`, `url`, `image_url`, `fallback_image` and `status`

An Insight is public only when its Article is published.

## B. Semantic and factual (a person, with the source)

Never decided automatically, and never answered by guessing:
- **Dates:** the actual event date, and whether to show the report date or the event date.
- **Movements:** whether a summary matches the article.
- **Patterns:** whether a Pattern follows from its movements.
- **Takes:** whether a Take overstates.
- **Snapshots:** whether a Snapshot reflects the brand today.
- **Insights:** whether an Insight's AI analysis matches its source article.

The report lists these under "자동으로 판단하지 않은 것" (what was not judged automatically). The specific cases the
structure points to (a date question, a stale Snapshot) appear as 🟡 questions in "내가 확인할 것" (questions for you).
V1 does no live web checks.
