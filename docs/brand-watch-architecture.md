# Brand Watch foundation

Brand Watch explains a brand's recent marketing direction in five minutes. It is an intelligence layer beside Articles/Insights, not a news feed. This phase defines contracts only: no ingestion, AI calls, routes, admin UI, public queries, or production migration.

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

Production application, rollback approval, registry seeding, ingestion adapters, source rights/retention, event identity review, atomic audit commands, downstream correction handling, public DTOs/eligibility counts, cache budgets and SEO/UI are deferred. Opportunity, MKTI, Video Engine and newsletter changes are out of scope.
