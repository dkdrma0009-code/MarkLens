# MarkLens Review Hub V1

The Quality Review finds problems. The Review Hub is where a person looks at them and decides what to do. It lives in
one Notion database. Notion only records judgements and history. It never runs code, never changes data, and never
publishes or deploys anything.

```
Quality Review (report.json → reviewItems) → review-hub-sync (plan) → Notion "MarkLens Review Hub" → a person decides → MarkLens work fixes → next review
```

## Where it is

- **Page `MarkLens Review`:** private. It holds the summary "오늘 내가 볼 것", which gives counts and the open titles.
- **Database `MarkLens Review Hub`:** inside that page. This is the only database. There are no separate projects,
  tasks or decisions databases.

## What becomes a page

- One page per item in `report.json → reviewItems` that is OPEN when first seen.
- Accepted known issues (ACKNOWLEDGED / DEFERRED in `docs/quality-review/known-issues.json`) that never needed attention
  stay in the report only.
- Findings on sample data (LOCAL_SAMPLE), test pages (TEST_FIXTURE) and anything that passed never become pages.
- A red (꼭 수정) finding is always eligible, whatever its scope or known-issue status.

**Item keys.** Each item has a stable key (`고유 키`), so the same problem is always the same page.

| Item | Key | Example |
| --- | --- | --- |
| Content item: each date or Snapshot question is its own decision | `rule\|target` | `CONTENT-SNAPSHOT-001\|당근` |
| Design or functional rule | the rule alone; its places are listed on the page | `DESIGN-TEXT-001` |

## Properties

| Property | Who writes it | Meaning |
| --- | --- | --- |
| 제목 | sync | The question or task, in plain Korean |
| 상태 | sync and person | See below |
| 중요도 | sync | 꼭 수정 (red) · 확인 필요 (yellow) |
| 종류 | sync | 결정 (decide a direction) · 확인 (look at the result) · 수정 (just fix it) |
| 대상 | sync | Brand or area: 무신사, 당근, 홈, 인사이트, Brand Watch … |
| 이유 / 추천 / 선택지 | sync | Why it matters, a recommendation, the choices. A recommendation appears only when an existing rule supports it. The date item has none. |
| **내 결정** | **person only** | The choice a person makes. The sync reads it and never writes it. |
| 발생일 / 마지막 확인 | sync | When it was first seen, and the last review that saw it |
| 고유 키 / 검수 기록 | sync | Do not edit. They hold the item key and the review status plus a content fingerprint, written as plain text: `s=OPEN h=6a255decef07`. |

**Page body.** It shows what a person needs first: the facts, why, the recommendation and the choices. Rule ids and raw
messages are inside the **자세히 보기** toggle.

## 상태

| 상태 | Set by | Meaning |
| --- | --- | --- |
| 결정 필요 / 확인 필요 / 할 일 | sync | Open: decide, review, or fix |
| 진행 중 | person | Being worked on. The sync keeps it. |
| 보류 | sync or person | Deferred. Set by the sync when the known issue is DEFERRED, or by "내 결정 = 나중에 결정". |
| 확인됨 | sync or person | Accepted (ACKNOWLEDGED) |
| 완료 | sync | No longer found by a review that actually ran that check |

## How a sync moves a page

| Situation | Operation | Result |
| --- | --- | --- |
| New OPEN item | CREATE | A new page |
| Same report again | TOUCH | Only `마지막 확인` moves. No new page. |
| Known-issue status changed (OPEN ↔ DEFERRED ↔ ACKNOWLEDGED) | UPDATE | Status follows, with the note "검수 상태 변경: … → …" |
| `내 결정` set on a 결정 필요 page | UPDATE | Becomes 할 일, or 보류 for 나중에 결정, with the note "결정 기록: …". The decision is never executed. |
| Content changed (more places, new dates) | UPDATE | Text is refreshed. A status the person set (진행 중, 보류, 확인됨, 할 일) is kept. |
| Gone from the review, and its check ran | CLOSE | The page becomes 완료. It is never deleted, and the note says why. |
| Gone from the review, but its check did not run | HOLD | The page is left as it is (see below) |
| A 완료 item appears again | REOPEN | The same page reopens, with the note "다시 발견됨" |
| A red finding on a 완료 / 보류 / 확인됨 page | REOPEN | Always shown again |

### CLOSE safety

A missing item is closed only when the check that would find it finished in this report. Each rule maps to the report
section that produces it:

| Rules | Report section |
| --- | --- |
| `CONTENT-` | Brand Watch |
| `INSIGHT-` | Insights |
| `DESIGN-`, `FUNC-IMAGE/PAGE/LAYOUT-` | 화면 자동 검수 |
| `FUNC-ROUTE-` | 페이지 응답 |
| others | their own sections |

The section must be PASS, REVIEW or FAIL. If it was SKIPPED or ERROR, is missing, or the report has no sections, the
page is held instead. The sync then prints `HOLD … 이번 검수에서 해당 검사가 실행되지 않아 완료로 바꾸지 않았습니다`.
An incomplete or crashed review therefore never marks anything 완료.

## Run it

Quality Review and the sync are separate commands. The review never depends on Notion.

```bash
node tools/quality-review.mjs --base http://localhost:3000      # writes .quality-review/report.json
node tools/review-hub-sync.mjs                                   # dry run (default): plan only, nothing written
node tools/review-hub-sync.mjs --apply local                     # apply to .review-hub/state.json (a local hub)
node tools/review-hub-sync.mjs --apply notion                    # apply to the Notion database (REST)
```

**Output.** Every run writes `.review-hub/plan.json` (counts, held pages, operations, summary) and
`.review-hub/preview.md` (the summary and the page bodies). `.review-hub/` is git-ignored.

**Options:**
- **`--report <file>`:** the review report. The default is `.quality-review/report.json`.
- **`--state <file>`:** plan against a hub snapshot.
- **`--out <dir>`:** where the output goes.

## Notion connection

There are two ways to write to Notion.

- **REST (`--apply notion`):** needs an internal integration shared with the database. Set `NOTION_TOKEN` and
  `NOTION_REVIEW_HUB_DATABASE_ID` in the shell. Never write them into `.env` or a file in the repo. Without them, the
  command prints `CONNECTION REQUIRED` and writes nothing. Errors never include the token.
- **Claude's Notion connector:** an agent can apply the dry-run plan through the connector. It uses the
  `properties` and `preview.md` bodies of each operation as they are, and reads the rows back to check.

**Rules for writing to Notion:**
- Write only to the `MarkLens Review Hub` database. Never edit other MarkLens documents.
- Never delete a page. A resolved item is 완료.
- Never write `내 결정`.
- No deletion tests against the real hub. Test with `--apply local` or with tests that use a fake `fetch`.

## Files

- **`tools/review-hub/hub.mjs`:** pure planning (items → operations), page body, local hub, summary.
- **`tools/review-hub/notion.mjs`:** the Notion REST adapter.
- **`tools/review-hub-sync.mjs`:** the CLI.
- **`tests/review-hub.test.mjs`:** creation, no duplicates, defer and reopen, decisions, close and reopen, red always
  shown, the REST adapter, close safety.
