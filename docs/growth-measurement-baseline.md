# MarkLens Growth Measurement Baseline

Baseline date: **2026-10-11**. Status: **Pre-Relaunch**.
Production base: `4f9525fcb12a3337334e400a5cc3478c3d84c7e2`.
Measurement clean start: **PENDING — record the actual production deployment date
after this change and completion of the manual GA4 checklist.** This work is not deployed.

## Historical baseline — user-provided GA4 observations

Last 90 days: 46 active users, 43 new users, 94 sessions, 352 page views,
57 engaged sessions, 60.64% engagement rate, 50.8 seconds average engagement/session.
These are **pre-cleanup raw observations** including owner, Admin, QA, Vercel
referral and production verification. **46 active users is not external audience.**
Historical data is neither modified nor reinterpreted as clean data.

| Source example | Users | Sessions |
| --- | ---: | ---: |
| Direct | 26 | 39 |
| Google organic | 9 | 20 |
| Vercel referral | 2 | 14 |
| Instagram bio | 5 | 13 |
| Instagram referral | 6 | 6 |
| Facebook referral | 2 | 2 |

Source rows are overlapping examples, not additive audience totals.
Observed events: newsletter_view 35, form_start 5, newsletter_submit 3,
newsletter_subscribe 2, newsletter_already 1. Subscribe was not a Key Event.
Pre-clean-start newsletter_subscribe represents pending signup / confirmation email success and must not be interpreted as confirmed subscribers.
Historical counts remain unchanged; this definition also remains unchanged after clean start.
`form_start` was not explicitly emitted by application code; inspect enhanced
measurement before attributing this historical count to the app.

## Measurement lock

Only `NODE_ENV=production`, exact hostname `marklens.site`, and a Vercel environment
of `production` (or absent for non-Vercel production) may initialize GA.
localhost, 127.0.0.1, www, noncanonical hosts, development, test and Preview do not.
No redirect rules are changed. `/admin`, descendants, `/login`, auth and API routes
are excluded. The SDK disable flag reads current route and cookie at dispatch,
including after client navigation. Explicit app events use the same policy.

Page views are manual with `send_page_view:false`. The app deduplicates repeated
effects for the same page. **Disable enhanced history page views before release**
using the checklist below, otherwise the SDK may also emit automatic page views.
This external setting is not changed by code.

Only safe campaign identifiers survive page/referrer query strings. Event
parameters allow only logical `location` and `position`; email, raw form values,
subscriber/auth IDs, IP and names are never added. SDK traffic necessarily has
network metadata; this policy concerns application-supplied analytics parameters.

## Internal browser

The existing proxy verifies Supabase `auth.getUser()` and compares ADMIN_EMAIL.
Only successful authenticated `/admin` document/navigation responses set
`marklens_internal=1`, Path=/, SameSite=Lax, one year, Secure on HTTPS.
This readable boolean is an analytics opt-out, **not authorization**. It cannot
grant admin access. API-secret/cron bypasses and ordinary users do not set it.
It persists after logout; clear it explicitly only to restore audience measurement:

```js
document.cookie = "marklens_internal=; Max-Age=0; Path=/; SameSite=Lax; Secure";
location.reload();
```

Run on marklens.site, or delete this cookie in browser site storage. An authenticated
Admin visit marks it again. Use a separate non-admin browser/profile for audience QA.
Owners who have never visited Admin, incognito, cleared cookies and other devices
cannot automatically be identified as internal. Visit Admin once per operator browser.

## Newsletter event contract

- `newsletter_view`: subscription form enters viewport (50%), once per mount.
- `newsletter_submit`: accepted submit attempt, before the request; synchronous
  in-flight ref blocks double clicks. Existing source/location/position stay intact.
- `newsletter_subscribe`: successful response with `success:true` and
  `subscriptionCreated:true`, never already/emailFailed/HTTP failure/malformed response.
- `newsletter_confirmed`: not emitted (Option B). GA is not the confirmed KPI
  source of truth; a success-page view is not proof of a transition.
- `newsletter_already`: successful already-subscribed response only.
- Existing pending retries/reactivations still show the original confirmation UI
  but do not claim a new subscriber. No automatic retry is added.

The additive `subscriptionCreated` flag is now returned by the atomic signup RPC:
new insert only, never pending resend/reactivation or active. Unknown errors fail
closed. Existing delivery and form UI remain unchanged. `newsletter_subscribe`
means **new signup accepted / confirmation email successfully issued**, not
completed double opt-in, and remains a secondary funnel diagnostic.

GA funnel: `newsletter_view` → `newsletter_submit` → `newsletter_subscribe`.
Primary confirmed-subscriber KPI: successful DB pending → active transition,
recorded by `confirmed_at`. GA events are not an authoritative subscriber ledger.
`confirmed_at` records the latest confirmation per subscriber; it is not a complete
historical event log for multiple unsubscribe/reconfirmation cycles. Pre-migration
active rows have no backfilled confirmed_at and cannot supply historical conversions.
Component guards cover double clicks/repeated responses, not guaranteed GA delivery.

## Relaunch UTM taxonomy

Campaign: `marklens_v2_relaunch`. Lowercase ASCII, stable identifiers, no spaces
or meaningless UUIDs. Source: instagram / threads / linkedin / community / newsletter.
Medium: social / community / email. Content identifies the actual content asset.
`src/lib/tracked-url.ts` exports `buildTrackedUrl` and seven `relaunchLinks`.
Existing query/fragment are preserved; duplicate UTM keys are replaced. External
origins and malformed/non-ASCII campaign identifiers are rejected.

| Preset | Production link |
| --- | --- |
| Instagram Bio | https://marklens.site/newsletter?utm_source=instagram&utm_medium=social&utm_campaign=marklens_v2_relaunch&utm_content=ig_bio_01 |
| Instagram Carousel | https://marklens.site/?utm_source=instagram&utm_medium=social&utm_campaign=marklens_v2_relaunch&utm_content=ig_carousel_01 |
| Instagram Reel | https://marklens.site/?utm_source=instagram&utm_medium=social&utm_campaign=marklens_v2_relaunch&utm_content=ig_reel_01 |
| Threads | https://marklens.site/?utm_source=threads&utm_medium=social&utm_campaign=marklens_v2_relaunch&utm_content=threads_launch_01 |
| LinkedIn | https://marklens.site/?utm_source=linkedin&utm_medium=social&utm_campaign=marklens_v2_relaunch&utm_content=linkedin_launch_01 |
| Community | https://marklens.site/?utm_source=community&utm_medium=community&utm_campaign=marklens_v2_relaunch&utm_content=community_everytime_01 |
| Newsletter | https://marklens.site/insights?utm_source=newsletter&utm_medium=email&utm_campaign=marklens_v2_relaunch&utm_content=weekly_001 |

These are prepared links only, not published. Existing `/ig` legacy redirect and
sent newsletter links are deliberately unchanged; use the full new preset URL at relaunch.

## Growth targets

North Star: **External Monthly Active Users** (distinct users over the period,
not the sum of daily active users). Supporting: new external users, organic search,
organic social, newsletter subscriptions, returning users.
First milestone: **100 external users / 30 days**. This is a target, not observed data.
DB insight view_count is a separate raw counter and does not become filtered GA audience.

## Manual GA4 checklist — no settings changed in this work

1. Correct Marklens property / web stream / G-9NCMJC4V6L (or deployed GA ID).
2. Option B: no confirmed GA Key Event is available in this release. Only if a
   future safe handoff is implemented and verified:
   Admin → Events / Key events → `newsletter_confirmed` → mark as key event.
   Do not use `newsletter_subscribe` as a primary conversion; retain it as a funnel
   diagnostic. Console labels may vary. No GA settings were changed.
3. Web stream → Enhanced measurement → Page views advanced options:
   disable **Page changes based on browser history events** when using app manual page views.
   Also review automatically collected forms/outbound/search events for unwanted PII.
4. In isolated audience QA, verify one page_view per route in Tag Assistant/DebugView;
   localhost/Preview/Admin/login/internal profile must send none. Do not test a real
   subscription or email send as part of this code QA.
5. Record actual deployment date/time and property timezone as clean-start boundary;
   compare future periods after that boundary only. Cookie exclusion is forward-only.

References: [manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views),
[enhanced measurement](https://support.google.com/analytics/answer/9216061),
[key events](https://support.google.com/analytics/answer/9322688),
[SDK opt-out](https://developers.google.com/tag-platform/security/guides/privacy).

## Local QA — 2026-10-11

- TypeScript PASS; full ESLint 0 errors / existing Satori warning 1;
  production build PASS (1082 static pages); diff check PASS.
- 116 assertions executed actual analytics, proxy, subscribe route, form handlers
  and impression hook with isolated DOM/React/API mocks. No live GA collector,
  subscriber DB write, or email send was used. Preview on the canonical host is
  also excluded by the server-provided deployment environment.
- Local browser: home, insights, actual article, newsletter, practice, Admin,
  Admin/articles and login had zero GA SDK scripts. Unauthorized Admin redirected
  to login. Authenticated Admin cookie behavior was verified with auth mocks,
  not a real login or production auth change.
- Newsletter page new/already/emailFailed/failure/pending response UI and inline
  homepage confirmation passed against an intercepting local mock proxy. Both
  actual handlers passed synchronous double-submit and failure/retry tests.
- 390/768/1440: no horizontal overflow; no browser console errors. Radar auto
  rotation, Pulse movement, Signals sticky/active change, Collections crossfade
  and Weekly/Footer composition remained intact. CSS/motion/logo assets unchanged.
- Production GA collection and external Key Event/history settings are **not
  end-to-end verified by local mocks**. Complete the manual checklist at release.
- No commit, push, deployment, GA settings change, newsletter send or social publish.

## Double opt-in integrity pass — 2026-10-11

### Schema audit and migration

Read-only production column probes (select with limit=0, no subscriber rows)
verified status exists and confirmation_token, confirmation_expires_at,
confirmed_at, created_at, updated_at do not. Repository migrations define email
unique, id, status, subscribed_at, unsubscribed_at, drip_step and source.
Service-role server client has no persisted auth; existing RLS remains unchanged.
Migration 016 adds only token/expiry/confirmed_at and a unique partial token index,
plus service-role-only SECURITY INVOKER RPC functions, including one-off legacy
recovery claim/release functions. No production migration
or row rewrite has been performed. Apply migration BEFORE deploying handlers;
missing RPC returns failure, never fake subscription success.

Existing pending recovery strategy: preserve rows and reissue fresh hardened
confirmation links after deployment and separate user approval. No insecure legacy
fallback/grace period; old deterministic links remain invalid. Eligible rows are
pending with token, expiry and confirmed_at all NULL. Existing active and new
hardened pending rows are excluded. No backfill or automatic active conversion.
The previous read-only production preflight found total 11, active 9, pending 2;
this is a historical preflight, not a promised count at future execution time.
Migration and recovery must not execute automatically on this result.

### Token and state lifecycle

New/resend tokens use two crypto.randomUUID values (244 random bits), hex 64 chars,
unique in DB; not the old secret/email-derived token. DB clock establishes 48-hour
TTL. The signup RPC serializes insert/resend against confirmation, rotates token
and expiry, preserves first source, and cannot regress an active row to pending.
Concurrent resends may deliver a superseded link; only the latest stored token is
valid. Email failure leaves a pending row for a new resend; no conversion event.

Confirmation RPC performs a single UPDATE with email + token + pending + unexpired
conditions and RETURNING id. Exactly one changed row succeeds; unexpected multiple
rows raise and roll back. Success clears token/expiry and sets confirmed_at and
subscribed_at. Repeated URLs and already-active rows cannot transition. Exceptions
and malformed RPC row counts are failures, never success HTML. Welcome email only
runs for the winning transition; email failure does not roll back confirmation.
Endpoint keeps standalone minimal UI with confirmed / invalid_or_consumed / expired /
failure states. HEAD is non-consuming. GET remains the existing confirmation action;
email scanners performing full GET can consume links (no new interactive flow added).

### Analytics decision and privacy

**Option B selected: no newsletter_confirmed event.** Browser delivery exactly once
is not guaranteed by the standalone HTML architecture. Growth Measurement is not
blocked by this limitation; use DB confirmed_at for the confirmed KPI and the GA
three-stage signup funnel for diagnosis. Do not mark newsletter_subscribe as the
primary conversion. Historical newsletter_subscribe 2 remains unchanged.
No Measurement Protocol, new secret, token client storage, analytics token/email/ID,
or PII logs were added. HTML has no tracking scripts or reflected token/email;
no-store/no-referrer/noindex headers reduce caching/referrer leakage. Infrastructure
access logs/browser history can still contain incoming email/token URL; application
headers cannot erase upstream logs. Do not export those URLs to analytics.

### QA and operational limits

Actual migration/functions run against an ephemeral PGlite PostgreSQL engine,
never production. Idempotent migration, TTL, valid/invalid/expired/consumed,
resend old/new, active preservation, DB trigger failure rollback and service-role
function permissions verified. Promise.all duplicate calls produce one transition;
PGlite serializes on one backend, so this is not a multi-connection lock stress test.
PostgreSQL conditional UPDATE rechecks after row-lock waits. Actual route handlers
also tested with mocked RPC/email transport, including malformed responses and
failures. Test file: tests/subscription-confirmation.test.mjs; set PGLITE_MODULE
to an external installed @electric-sql/pglite path to include SQL tests (otherwise
SQL suite is explicitly skipped). Repository dependencies remain unchanged.
No live confirmation/email/write, production migration, GA setting change, commit,
push, deployment, or social publish was performed.

Final integrity-pass verification: TypeScript PASS; full ESLint 0 errors / existing
Satori warning 1; production build PASS (1082 static pages, existing Edge runtime
warning); diff and new-file whitespace checks PASS. Three hardening test suites
PASS with SQL suite enabled, plus 116 analytics regression assertions PASS.

## Legacy pending recovery — local implementation only

Tool: `node scripts/recover-legacy-pending-subscribers.mjs` (DRY RUN default).
Requires migration 016 first; on the current pre-migration schema it fails closed.
No row/email/token/ID is printed. Default performs a HEAD count only. Execute
requires explicit `--execute --expect-count N`; actual count mismatch aborts before
writes. Production execution requires separate human approval AFTER smoke + dry run.

The shared `src/lib/newsletter/confirmation-mail.mjs` is the existing Brevo
confirmation template extracted from subscribe, not a copied second template.
Both signup and recovery use the same helper and fresh URL construction. No design
change, schedule, new queue, outbox, analytics event or new mail provider is added.

Each candidate is claimed using a service-role-only conditional DB UPDATE on id
and all legacy predicates. DB sets expiry to clock time + 48 hours and preserves
status/confirmed_at/source/subscribed_at. Token is 32 cryptographically random
bytes (256 bits), protected by the existing unique index. A second claim returns
zero rows, so duplicate runners skip sending. Successful recovery removes the
row from future candidate lists. Failure never activates a subscriber.

If email fails, release only the issued token still matching that pending row;
clear token/expiry so the next approved run can retry. A simultaneous new signup
rotation or confirmation is protected by token/status predicates. Provider/DB
errors are never printed. If release fails, or claim completion is unknown, the
summary reports retryBlocked: stop and inspect privately; use the existing
subscribe resend flow only under a separate explicit approval. A process crash
between claim and send can leave a claimed pending row excluded from automatic
recovery; the existing resend flow is the recovery path, not an unconditional
reset. Never reset a token simply because a mail response is ambiguous.

Email and DB cannot be atomic: a provider may accept mail before a response is
lost. A caught failure releases the still-matching token, invalidating that link;
a retry may issue another email. Exactly-once provider delivery is not claimed.
This limited failure model is deliberate; no outbox architecture is introduced.

### Proposed production order (not executed)

1. Scope audit, code commit, RC verification (analytics + confirmation + recovery).
2. Remote master guard / branch push, without triggering production deployment.
3. Audit and apply migration 016, then verify columns/index/RPC privileges.
4. Verify old application compatibility; fast-forward master, verify and push;
   wait for Vercel READY/Current tied to the RC commit.
5. Production smoke (analytics/public/admin/UTM/confirmation headers, no writes).
6. Run recovery DRY RUN. Expected historical count is 2; inspect actual count only.
7. Obtain explicit user approval for that exact recovery count and email reissue.
8. Only then execute `node scripts/recover-legacy-pending-subscribers.mjs --execute --expect-count 2`
   if the approved count is still 2. No execute is authorized by this local pass.
9. Verify success/failure counts and pending/token/expiry state privately, no PII
   output. Reissue up to two confirmation emails; do not force active status.
10. Verify recovery completion and lock measurement clean-start. GA Key Event NONE;
    official confirmed KPI: active AND confirmed_at IS NOT NULL. Preserve raw history.

Local recovery QA: default CLI HEAD-only against a local mock server; invalid
execute flags/count guard; 2 → 0 candidates; active/new/reconfirmed protection;
duplicate invocation; failed mail retry; newer token/active race protection;
actual PostgreSQL recovery/consumption/expiry/permission tests. Production mutation
and real email send remain unauthorized and were not performed.

Final recovery-pass validation: TypeScript PASS; full ESLint 0 errors / existing
Satori warning 1; scoped ESLint 0/0; build PASS (1082 pages, existing Edge runtime
warning); diff PASS. Confirmation/recovery tests 8 PASS with SQL suites enabled;
analytics regression 116 assertions PASS. Shared mail template unchanged. The
recovery script has a narrow .gitignore exception; unrelated local scripts/reels
remain ignored. No staging/commit/push/deploy/production recovery was performed.
