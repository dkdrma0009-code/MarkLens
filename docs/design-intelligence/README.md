# MarkLens Design Intelligence V1

A small system for answering one question before any design change: **is this change MarkLens, or is it just a trend?**

It is research plus checks. It does not redesign the site. Changes it finds are listed for a person to approve.

## How it works

1. **Observe.** Capture real pages at 1440 and 390 with `tools/design-audit.mjs`, for both MarkLens and live reference sites.
2. **Evidence.** Keep the screenshots and the measured numbers (`report.json`). Every claim in these docs points to one or the other.
3. **Repeated pattern.** Something counts as a pattern only when it appears on several independent sites. The count is written down as X/N, never as a percentage guess.
4. **Compare with MarkLens.** Hold each pattern against the brand system ([design-bible.md](design-bible.md)): Editorial Authority → Signal → Frame.
5. **Judgement.** ADOPT / EXPERIMENT / HOLD / REJECT, with a one-line reason ([adoption-queue.md](adoption-queue.md)).

Conclusions are not decided first. A single reference is never copied. Dribbble-style shots are not evidence. Generic SaaS patterns are out of scope.

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
  The console prints 🔴 / 🟡 flags. `.design-audit/` is a scratch folder; do not commit it.

The script's flags are prompts to look, not verdicts. Then run [vision-review.md](vision-review.md) on the screenshots.

## Boundary with Content QA

Design Intelligence checks only whether dates **look** consistent on the page. For example, "Updated 2026.10.16" next
to "2026.10.08 기준" is flagged because a reader sees two different "as of" dates.

Whether a date is **factually** right belongs to Content QA. That includes the MUSINSA On&Off start date, or whether a
Snapshot includes the latest Move. The same split applies to image rights, source accuracy and wording.

## Version

V1, 2026-10-17. MarkLens baseline: `release/brand-watch-v1` at `c2e4898`, rendered locally with QA fixtures and sample insights.
