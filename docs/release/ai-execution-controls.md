# Phase 4A — AI execution controls (local development only)

Base: Production `9ff0b90da48256b6164f7b8728e99471649a42ed`.
No production deployment, settings changes, live AI, emails, social publishing or migration in this phase.

## Policy and precedence

| Setting | Behavior |
| --- | --- |
| `AI_KILL_SWITCH=on` | Highest priority. All paid AI denied, including manual context. Keep production unchanged. |
| `AI_AUTO_PAUSED=on` | Cron and shared legacy generation/webhook entry points return a successful intentional skip before AI or content writes. Unscoped AI egress is also refused, so public AI routes answer 503 `ai_paused` before taking a daily quota slot (`checkAiBudget`). |
| `AI_PUBLIC_ENABLED=on` | Separate explicit opt-in for public chat/interview/learn/Lab AI. Default is disabled; emergency switch still wins. |
| `AI_MANUAL_TEST_ENABLED=on` | Opt-in for the authenticated, nonpersisting admin sample endpoint only; does not bypass emergency or Preview protection. Default disabled. |

`AI_AUTO_PAUSED` is independent of `site_publish_auto`. RSS collection, onboarding mail, fallback-image maintenance, existing-ready site publication and privacy cleanup remain existing behavior. No cron schedules are changed.
Collect still reports `aiPaused`, backlog and stall counts, but does not recover analyzing rows, call the analysis worker, or send intentional analysis-stall/failure/backlog alarms while paused. Actual RSS failures still alert. Health displays intentional pause and backlog; model/key validity is explicitly unverified while paused.

Weekly quiz/newsletter/curation routes skip before generation, fallback assembly, inserts, replacement/deletion and approval/failure emails. Shared analyze-pending, seed and newsletter-generate endpoints use the same gate, covering secret-triggered legacy n8n calls. Legacy article/quiz/cardnews/shorts AI management routes also skip while stopped, before content writes. They are not the new manual-test exemption.

## Manual sample tests

`GET /api/admin/ai-test` requires the real admin session and returns the cost notice and limits. `POST` requires that session, explicit `acceptCost: true`, an allowlisted feature and a 10–2000 character sample. A webhook secret or request header never grants manual execution.

Features: article analysis sample, one interview question, one quiz, newsletter draft sample, cardnews cover sample. These are bounded text samples using the existing text-provider chain; they are **not** the full article analysis/persistence pipeline, real interview session, question-pool replacement, newsletter issue creation or carousel publishing. No UI redesign or production content writes are introduced.

Example body (do not execute against production):

```json
{"feature":"interview","sample":"검수자가 제공한 테스트 사실과 내용입니다.","acceptCost":true}
```

Limits: existing migration-024 `consume_ai_quota`, all admins combined 5 attempts/day, fail closed on missing RPC/DB failure; input max 2000 characters, output max 1000 tokens, one provider HTTP request per test, request timeout 20 seconds. Provider fallback/SDK retries cannot make a second network request. Quota is consumed on an admitted attempt, even if it fails. No new schema is required or applied. Future approved manual tests will update only the existing quota counter; no content table persistence.

AsyncLocalStorage scopes authorization per request, never a global manual flag. Global fetch guard checks emergency/Preview denial before manual authorization. `instrumentation.register()` installs the guard before requests; Edge does not import the Node-only context. Existing unauthenticated calls cannot borrow another request's scope.

Server logs record test ID, hashed actor, feature, success/failure, request count on success, output character count and duration. They exclude sample/output content and raw identity. Provider token usage is explicitly `not_recorded`; character counts are not presented as token consumption or currency. Actual cost measurement needs separately approved usage telemetry; the fixed input/output/request caps bound exposure meanwhile.

## Verification and activation

Provider tests use mock fetch/responses. Route tests mock the quota DB; an additional isolated PGlite test executes migration 024 and submits 32 competing quota requests (5 admitted), including an authenticated-role permission denial. PGlite queues queries on one connection, so this is not a multi-session production contention test; concurrency safety also relies on the single conditional PostgreSQL upsert. A Preview paid test additionally requires an isolated database, Preview AI permission and separate operator approval. Never unset production's emergency switch for testing. External live n8n status is unverified; checked repository workflow exports are inactive. Other services sharing FOODCOUPON credits are outside this application guard.

After review, separately approve deployment of this branch and production `AI_AUTO_PAUSED=on`; retain `AI_KILL_SWITCH=on`, public/manual opt-ins absent. Deploy the reviewed Phase 4A commit only, not Stage 3 or homepage C. Verify collection skip response, health pause and unchanged public rendering without executing paid tests. No environment/deployment action is authorized by this document.

Rollback to the previous exact Production deployment with its emergency switch on. Remove only newly approved flags as appropriate; retain the emergency switch. Re-enabling automatic AI later requires a separate decision. Keep SNS drip OFF. Scheduled social publishing is a distinct path and remains unchanged.

## Local verification record — 2026-11-01

- New controls tests: 32 passed. Controls + affected existing regression tests: 85 passed.
- Full suite: 393/394 passed. The sole failure is `tests/brand-watch-launch.test.mjs:469`, date semantics: expected UTC string `2026-09-14T15:00:00…`, received equivalent instant `2026-09-15T00:00:00+09:00`. Reproduced on a separately extracted, unchanged `9ff0b90` source snapshot with the same PGlite runtime. No Brand Watch/SQL/test repair in this phase.
- TypeScript passed; ESLint 0 errors / 1 existing Satori image warning; production build passed with the existing Edge runtime warning; whitespace check passed.
- Local production output under emergency stop: Home 200, Insights 200, unauthenticated admin sample endpoint 401; guard startup log confirmed. Server stopped after verification. No live AI/provider test.
- Production remains the previous deployment with `AI_KILL_SWITCH=on`; no new flags, deployments, database migrations or content mutations were applied. Changes remain uncommitted on `codex/ai-execution-controls` for review.

## Independent Phase 4A-R review — 2026-11-01

- Found and fixed P1: production bundling duplicated the module-local AsyncLocalStorage between instrumentation and the admin route. Manual scope was invisible to the provider guard. The store now uses a process-global Symbol.for singleton; authorization remains request-local. Actual compiled functions were checked before/after without network: route scope visibility false → true; second request blocked; calls 1; outside scope false.
- Added separate-module-copy and real admin-helper tests (authenticated nonadmin and missing allowlist denied), plus the isolated SQL quota test above. Controls tests 34 passed; including SQL quota 35; affected regression set 88 passed. Full suite 396/397 passed, with the same baseline date-format failure reproduced again against unchanged 9ff0b90.
- TypeScript and production build passed; ESLint 0 errors / 1 existing Satori warning. Local production with both stop flags: Home 200, Insights 200, unauthenticated admin test 401. Whitespace check passed.
- P2 at review time (resolved in Phase 4A-F below): legacy `/api/admin/shorts/render` kinetic composition attempted its AI script and returned 500 when blocked, rather than an intentional skip. Provider egress was denied; this was an error-presentation inconsistency, not a cost bypass.
- External live n8n state, real paid-provider success, multi-session quota contention and deployed Vercel behavior remain unverified. No production changes, paid calls, email/social sends, commit or push.

Reviewed files (relative to repository root):

```text
AGENTS.md
CLAUDE.md
docs/release/ai-execution-controls.md
src/instrumentation.ts
src/proxy.ts
src/lib/release/guard.mjs
src/lib/api-auth.ts
src/lib/ai/manual-context.ts
src/lib/ai/budget.ts
src/lib/ai/llm.ts
src/lib/ai/gemini.ts
src/lib/ai/quiz.ts
src/lib/ai/errors.ts
src/app/api/admin/ai-test/route.ts
src/app/api/admin/cardnews/generate/route.ts
src/app/api/admin/health/route.ts
src/app/api/admin/quiz-bulk/route.ts
src/app/api/admin/shorts/diagnose/route.ts
src/app/api/admin/shorts/render/route.ts
src/app/api/articles/analyze/route.ts
src/app/api/cron/collect/route.ts
src/app/api/cron/ig-daily/route.ts
src/app/api/cron/quiz-seed/route.ts
src/app/api/cron/newsletter/route.ts
src/app/api/cron/curation-weekly/route.ts
src/app/api/cron/privacy-purge/route.ts
src/app/api/generate-quiz/route.ts
src/app/api/learn/seed/route.ts
src/app/api/newsletter/generate/route.ts
src/app/api/webhooks/analyze-pending/route.ts
supabase/migrations/024_ai_usage_quota.sql
vercel.json
n8n/workflow-collect.json
n8n/workflow-newsletter.json
tests/ai-execution-controls.test.mjs
tests/ai-manual-quota.test.mjs
tests/ai-budget.test.mjs
tests/analysis-failure.test.mjs
tests/analysis-quality.test.mjs
tests/preview-guard.test.mjs
tests/brand-watch-launch.test.mjs
node_modules/next/dist/docs/01-app/02-guides/instrumentation.md
```

## Phase 4A-F final readiness — 2026-11-01

### P2 resolution and API contracts

Reproduced before fixing: both stop flags produced HTTP 500 from the kinetic route; the admin consumer also started status polling after receiving a successful skip response. The route now checks `automaticAIStopped()` only for `ReelKineticVideo`, after authentication/input validation and before DB access or script generation. It returns HTTP 200 `{ skipped: true, reason: "automatic_ai_paused" }`, matching existing paused generation endpoints. The consumer displays an informational pause notice and returns without polling or changing render results; its existing finally block clears busy state.

Unauthenticated requests remain 401, invalid requests 400, and actual unpaused script failures 500. Shorts/Reel non-AI behavior is unchanged. The dedicated manual sample endpoint retains 503 for disabled/kill-switch state, 401 for denied authentication, 429 for quota exhaustion and 502 for provider failure; it is not this legacy render endpoint. No scheduler currently calls shorts/render in the checked repository; cron generators retain their HTTP 200 intentional-skip contract. No AI call, render job, DB query/write or failure alert occurs on the kinetic skip path.

### Final checks

- 8 added regression tests: pre-fix failures reproduced; post-fix all pass. Checks cover both stop flags, auth/input validation, unchanged non-AI missing-card behavior, actual script failure, and consumer skip/error handling without polling.
- Controls tests 42 passed; including SQL quota 43 passed. Related regression set 96 passed.
- Full suite 404/405 passed; sole failure remains the original Brand Watch date-format assertion (previously reproduced on 9ff0b90). No new regression.
- TypeScript passed. ESLint 0 errors / 1 existing Satori warning. Production build passed with existing Edge runtime warning. Local production with both stop flags: Home 200, Insights 200, unauthenticated manual-test endpoint 401. No live AI/provider or video generation.
- Cron schedules, privacy-purge route, n8n templates and migrations have no diff against the base. SNS/site-publication configuration was not changed or re-read from production in this pass.
- No n8n connector or authenticated n8n management tab was available. Live workflow state remains unverified; template `active: false` is not evidence of external runtime state. The app guard protects provider calls made inside this instrumented MarkLens runtime, including incoming protected webhooks. It cannot stop a separate n8n workflow calling providers directly or another FOODCOUPON client.

### Proposed release steps — approval required, not executed

1. Review the entire uncommitted Phase 4A + 4A-R + 4A-F diff on `codex/ai-execution-controls`; exclude local QA outputs/secrets. Obtain separate approval for commit/push/deployment. Preserve base 9ff0b90 and record the exact new RC commit when authorized.
2. Recheck the current Production commit and SNS OFF state read-only before release; stop on unexpected drift. Confirm existing quota migration 024/RPC availability without modifying data (missing RPC fails closed). No new migration is required.
3. With separate environment approval, keep Production `AI_KILL_SWITCH=on`, set `AI_AUTO_PAUSED=on`, and leave `AI_PUBLIC_ENABLED` / `AI_MANUAL_TEST_ENABLED` absent or off. Apply only to the separately approved deployment; no Preview or billing changes are needed.
4. Deploy only the reviewed Phase 4A RC through the existing release flow; verify READY and exact commit. Read-only public/admin smoke, configuration inspection and passive normal-cron logs must show RSS retained and intentional AI skips. Do not trigger paid tests, mail, social or content mutations for QA.
5. Before any future kill-switch relaxation: inspect actual n8n workflow activation, URLs, direct provider nodes and retry schedules; audit other FOODCOUPON clients; verify scoped authorization in the deployed runtime and obtain separate paid-test approval. This release does not activate manual or public AI.

Rollback: restore the previous exact Production deployment for 9ff0b90 while retaining `AI_KILL_SWITCH=on`. Restore only newly approved flags to their previous values; keep SNS drip OFF. No schema/data rollback is required by this change. Keep the new RC available for diagnosis; no history rewrite or data deletion.

This pass changes only shorts/render, its existing response consumer, the controls regression tests, and this document, on top of the preserved Phase 4A/4A-R work. No commit, push, deployment, production configuration/DB mutation, paid AI, email or social send was performed.
