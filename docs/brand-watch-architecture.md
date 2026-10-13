# Brand Watch foundation

Brand Watch explains a brand's recent marketing direction in five minutes. It is an intelligence layer beside Articles/Insights, not a news feed. Phase 1 defines domain/schema contracts; Phase 2 adds manual source ingestion functions described below. There are no ingestion jobs, AI calls, routes, admin UI, public queries, or production migration.

## Existing architecture boundary

Migrations 001–017 cover Articles/Insights, newsletters, subscriptions, career tools and supporting operations. `articles` links to `insights`; RSS collection uses `rss_sources`. `src/lib/ai/` handles existing Insight/newsletter analysis. Public selects live in `src/lib/insights/public-select.ts`; changed Insight slugs are revalidated by `src/lib/revalidate.ts`. Admin APIs authorize through `isAdmin` and write with `createAdminClient` (service role). The sitemap currently lists published Insights. None of these paths is changed. `src/lib/brand/` remains logo code; intelligence lives in `src/lib/brand-watch/`.

## Constitution and entity boundaries

Source → Evidence → Movement is the **fact layer**. Theme → Pattern → Take → Snapshot is the **analysis layer**, explicitly separated from reported facts. AI cannot create entities: future commands must resolve registry entities and existing database UUIDs. A mention is not an action. Multiple reports of the same event belong to one Movement, supported by multiple Evidence fragments. Patterns require at least two independent events. A Take must remain traceable to the actual source. A Snapshot describes direction rather than summarizing one article. Correction, superseding and history take precedence over deletion.

Entities support company, brand, service and sub-brand. Controlled directed relations express ownership and service/sub-brand boundaries without a single parent column. Registry UUIDs and slugs are stable seed definitions; importing the registry performs no writes. Only five entities are defined:

| Entity | Slug | Boundary |
| --- | --- | --- |
| MUSINSA / 무신사 | musinsa | Store/Global/Beauty are core scope candidates; 29CM separate related entity, Standard separate sub-brand candidate |
| OLIVE YOUNG / 올리브영 | olive-young | Retail/app/global/N Seongsu core; PB brands require separate review |
| TOSS / 토스 | toss | Bank/Securities/Place separate related candidates |
| BAEMIN / 배달의민족 | baemin | Bmart/Store/Pickup/Club service candidates; Woowa corporate-only excluded |
| DANGGEUN / 당근 | danggeun | Core service; major extensions require relation review; corporate/hiring-only excluded |

No child entities are seeded. Alias resolution does not resolve related brands to the parent. NFKC + lowercase + trimmed/collapsed whitespace is the normalization policy, enforced by a unique generated PostgreSQL alias column and tested against the TypeScript normalizer. Future Unicode aliases should be tested against both database collation and JS casing before admission.

## Schema and provenance

Migration `018_brand_watch_foundation.sql` creates 19 tables: the 18 requested core tables plus `snapshot_takes` for snapshot lineage. UUIDs, restrictive provenance FKs and same-entity composite FKs prevent cross-brand evidence links. Deleting a linked existing Article only clears `existing_article_id`; its Brand Watch source survives. Review events use typed target kind + UUID, deliberately without a polymorphic FK; the future admin command must verify targets and write the event atomically.

Providers have an internal tier/reliability **policy**, not a truth probability. Source document versions are deduplicated by canonical URL + SHA-256 hash: exact retries are idempotent; changed content gets a new row. Hash indexes support detection of syndicated copies, but identical content on distinct URLs is retained to preserve attribution. Canonical URL normalization and actual hash computation are deferred to ingestion.

Source identity/content metadata is immutable. Raw content is optional and requires rights basis and retention deadline. Retention expiry is a policy field; a purge job is deferred and must delete raw content only, preserving facts, locators and provenance. Image use requires provenance and does not imply reuse rights.

Evidence requires a source fragment or locator; model extraction requires model/prompt/pipeline versions. Approved Evidence payloads are frozen. Correction creates a new same-entity Evidence with `supersedes_id` and reason. The old record can be superseded/withdrawn without erasing its historical references.

`event_key` is unique per entity. It is a reviewed canonical event identity, not a model-generated label considered proof of independence. The future merge command marks a duplicate as superseded and records `merged_into_id`; automatic clustering/merging is not implemented. Offline/global are channel/scope dimensions, not Movement types. Movement types are campaign/creator/partnership/product/promotion/platform/brand. Themes are a separate candidate/approved/retired registry.

## Lineage, review and revision

Strict Zod 4 schemas validate domain commands (camelCase), separate from database rows/API DTOs. Unknown keys, invalid vocabulary, missing fragments, orphan IDs and cross-entity graph edges are rejected. The graph validator requires reviewed primary action matches, independent event keys and Take evidence reachable through its Pattern's Movements. Draft command schemas describe complete candidate analyses; the database permits incomplete drafts during review.

Database publication checks are deferred to transaction end: create draft → attach evidence/relations → publish. Movements require approved primary-action Evidence; Patterns require two independently keyed published Movements; Takes require a published Pattern and reachable Evidence; Snapshots require reviewed published Takes and exact lineage-derived source/evidence counts. Counts are distinct source documents, not necessarily independent publishers; eligibility must use provider-level distinct sources to avoid syndicated evidence inflation.

Published Movement payloads, Pattern/Take/Snapshot payloads and their junction links are immutable. Published analysis correction creates a successor with revision = predecessor + 1; one successor per revision prevents competing chains. First revisions start at 1. Status may move to superseded/withdrawn; it cannot revert to draft. A profile points to a same-entity published snapshot. Successor publication and profile switching must be one reviewed transaction. Historical links remain available after upstream withdrawal; Phase 2 must explicitly flag/review impacted downstream analyses rather than silently rewriting history. This is revision storage, not full event sourcing.

Review events are append-only with actor, timestamp, target, reason and approve/edit/reject/merge/split/supersede/publish/unpublish actions. Creating revisions, relation changes and audit recording must be transactional in future service commands. Draft deletion is allowed only where restrictive FKs permit; published history cannot be deleted.

## Public / SEO eligibility and security

DB coverage is separate from public/SEO coverage. `evaluateEligibility` uses an explicit clock and service-computed coverage: public candidate requires three recent-90-day reviewed Movements, two distinct providers, at least one Take and a Snapshot. SEO adds three providers and a meaningful update within 90 days. Counts and meaningful timestamps must be computed from reviewed lineage, not supplied by an AI model. Eligibility is a candidate flag, not automatic publication.

Profiles hold operating/public/SEO statuses plus nullable manual overrides requiring a reason. No count thresholds are frozen into DB constraints. Phase 2 must implement authorized overrides, reviewed publication and last-meaningful-update semantics. No Brand Watch rows enter the sitemap now.

RLS is enabled on every new table, with no anon/authenticated policies or grants. Service role has explicit access; audit events permit only SELECT/INSERT. Trigger functions are not public RPCs. Authenticated does not mean administrator; future admin endpoints must retain existing `isAdmin` checks. Public read DTOs/published-only policies require a separate implementation and security review.

## Migration safety and deferred work

018 is transactional and repeat-safe for its own unchanged schema (CREATE IF NOT EXISTS tables/indexes, replace functions/triggers, guarded profile FK). It does not reconcile arbitrary schema drift and must not be used to repair manually changed tables. No existing trigger/function is replaced. No data backfill or live seed is executed. Tests run the actual SQL twice in isolated PGlite PostgreSQL with local roles and an Article FK fixture.

Production application, rollback approval, registry seeding, source rights/retention policy approval, event identity review, atomic audit commands, downstream correction handling, public DTOs/eligibility counts, cache budgets and SEO/UI are deferred. Opportunity, MKTI, Video Engine and newsletter changes are out of scope.

## Phase 2: source ingestion foundation

Implemented flow: **Source Registry → Adapter → Normalization / Canonicalization → Idempotency → Entity Candidate → Relevance Candidate → [NEXT: Evidence Extraction]**. The modules under `src/lib/brand-watch/sources/` expose manual, dependency-injected functions only. No route, cron, existing RSS collector or AI queue invokes them. The current `articles` collector retains its URL uniqueness, title-token similarity checks, enclosure/OG lookup, fallback image behavior and cron/analyze integration unchanged.

`BrandWatchSourceAdapter` returns collected editorial documents, never database rows. RSS uses the existing `rss-parser` dependency's `parseString` after bounded fetching; XML DTD/entity declarations are rejected. HTML uses Cheerio with a provider-specific listing path pattern, title/body/date selectors and optional next-page selector. Missing title/body fails closed. Detail failure is isolated; listing failure propagates. There are no retries. A 429 aborts the collection immediately. Defaults: 10s timeout, 1 listing page, 10 items, 2MB response limit; ceilings: 30s, 3 pages, 25 items, 2MB and 3 same-domain redirects. Requests require HTTPS, exact configured hostname, default port and no credentials. Validation applies to every redirect and pagination link. Image URLs are metadata only and are never fetched by this layer.

Provider configuration is trusted, code-owned registry data, not accepted from user/client requests. `VERIFIED` means the specific robots/listing/detail structure was checked; it does not grant reproduction rights. Runtime collection requires `VERIFIED` plus confirmed robots. No anti-bot bypass, browser emulation or hidden JSON API discovery is implemented. Verified selectors still need future re-verification when a publisher changes its site.

### Read-only verification: 2026-10-13

| Provider | Status | Actual observation |
| --- | --- | --- |
| MUSINSA | NEEDS_VERIFICATION | Candidate `/newsroom/press` exists; server output has zero articles and robots endpoint returns HTML. No selector guessed. |
| OLIVE YOUNG | VERIFIED | `/ko/news` redirects to editorial. Official `/ko/newsroom/press` listing links and `/press/288` detail selectors verified; robots permits newsroom. Actual adapter read one detail and normalized title/text/date/image without issues. |
| TOSS | VERIFIED | `/newsroom` Korean HTTP listing and detail verified; robots permits newsroom. Actual adapter read one detail without issues. Generated body/date CSS classes are explicitly recorded in config and may drift. |
| BAEMIN / WOOWA | NEEDS_VERIFICATION | Official `/newsroom` responds, robots permits it, but server HTML has no article links. Client-rendered discovery remains unimplemented. Corporate-only stories remain relevance review candidates, not BAEMIN actions. |
| DANGGEUN | NEEDS_VERIFICATION | Official `/company/pr/` and `/company/pr/archive/.../` discovered from the company homepage. Listing has unusually large embedded content; a bounded clean extraction strategy is not verified. No parser activated. |

Verification used read-only HTTP, inspecting structure without storing official page bodies or writing database rows. Offline tests use original synthetic fixtures rather than copied publisher articles. No 429 was encountered in the live verification. The simulated 429 test proves immediate stop.

### URL identity, normalization and storage

Canonicalization removes fragments and known tracking keys (`utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `igshid`), normalizes hostname/default port through URL parsing and sorts query keys while preserving meaningful values and repeated-value order. Trailing slash is preserved by default; removal, extra tracking keys and explicitly known equivalent hosts are provider policies. No unknown www/subdomain equivalence is inferred. Original requested URL is retained across same-domain redirects; canonical/relative image resolution uses the final document URL. Credentials and non-HTTP protocols are rejected.

Hash v1 is SHA-256 of the JSON array `["bw-source-v1", NFKC/whitespace-normalized title, NFKC/whitespace-normalized meaningful text]`. HTML, layout, metadata and collection time are excluded. Missing/invalid dates become unknown, not collection time; day-only official Korean dates use explicit +09:00. Datetimes without explicit timezone are not inferred from the server environment.

Same canonical URL/hash is NO_OP; same URL with changed hash is REVISION_CANDIDATE; different URL with exact same hash is DUPLICATE_CANDIDATE. Changed versions and duplicate-source attribution are new rows, never upserts over prior documents. Similar-content/semantic/event clustering is deferred, and candidates do not merge events automatically.

`persistSourceDocument` validates normalized/domain contracts and takes a repository dependency. The Supabase implementation takes an explicitly supplied service-role client; importing it creates no client and performs no writes. Existing 018 provider FKs and URL/hash uniqueness provide race-safe insertion. A concurrent unique conflict resolves via exact row lookup. Candidate classification is advisory and can race with another version insertion; it is not an authoritative revision chain. No SQL RPC or new migration is introduced. Provider seed definitions remain inactive and are not inserted by this phase.

Raw text/HTML are not persisted by default. Explicit rights basis and future retention deadline are required to store text; HTML storage is opt-in. This makes retention/rights a caller obligation, not implied permission from an official URL. Normalized externalId/metadata remain in-memory domain fields because 018 has no corresponding columns; adding persisted operational metadata is deferred rather than silently repurposing fields. Article linking is optional and cannot change an existing exact-retry row. Image provenance stores its source document attribution, not a reuse license.

### Candidate and untrusted-content boundaries

Launch names/aliases create deterministic **mentioned** candidates with title/body location and `deterministic_alias` basis only; no primary/secondary action or truth score is inferred. Latin word boundaries prevent `TOSS` matching `tossed`; Korean names support following particles and may produce ambiguous candidates requiring review. Related-entity terms (e.g. Toss Bank) can mention the core alias but never resolve as a core marketing action. Title/body relevance signals require multiple independent keyword groups, with conflicting/single signals UNCERTAIN. All results require review; they cannot decide inclusion, generate Evidence or publish.

Normalized title, text, HTML, metadata, author and URLs are explicitly `UNTRUSTED_SOURCE_DATA`. Instructions such as “ignore previous instructions” stay article data; they are neither executed nor promoted to configuration/system prompts. Stored HTML is raw archival data and must never be rendered as trusted HTML. No LLM call exists here; a future Evidence pipeline must place source content only inside data delimiters and validate its output separately.

Phase 3 remains responsible for Evidence extraction/review, provider activation and rights/retention policy approval, entity boundary decisions, similar-content/event clustering, downstream corrections and atomic review events. Production seeding/migrations/scraping jobs, cron, UI, public SEO, newsletter, Opportunity and MKTI remain out of scope.
