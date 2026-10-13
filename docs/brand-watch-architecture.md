# Brand Watch foundation

Brand Watch explains a brand's recent marketing direction in five minutes. It is an intelligence layer beside Articles/Insights, not a news feed. Phase 1 defines domain/schema contracts; Phase 2 adds manual source ingestion; Phase 3 adds an injected-transport Evidence/Movement candidate pipeline. No live AI calls were performed. There are no ingestion jobs, routes, admin UI, public queries, or production migration.

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

Phase 3 candidate extraction/assembly is described below. Actual human review commands, provider activation and rights/retention policy approval, entity boundary adjudication, downstream corrections and atomic review events remain deferred. Production seeding/migrations/scraping jobs, cron, UI, public SEO, newsletter, Opportunity and MKTI remain out of scope.

## Phase 3: Evidence and Movement candidates

Implemented flow: **Source → Candidate Entity → Relevance Assessment → Evidence Extraction → Support Validation → Review State → Movement Candidate → Event Cluster Candidate → [NEXT: Human Review]**. `analyzeBrandWatchSource` is a manual pure orchestration service with explicit source reference, transport dependencies, trusted generation timestamp and optional cost policy. It returns the source, extraction assessment and unreviewed movements; it performs no database writes or publishing. A persisted source-item UUID is separate from the normalized document because each changed source version must have its own identity.

### Existing AI audit and transport boundary

The existing `src/lib/ai/llm.ts` uses Gemini flash-lite → flash internally, then Claude → OpenAI, with a 30-minute provider cooldown and raw error logging. `geminiJson` can perform additional Gemini attempts before that fallback chain. They do not expose the successful provider/model, enforce an overall attempt timeout, or stop all fallback on 429. Insight analysis uses editorial interpretation prompts and loose JSON extraction; pending workers write Article states and Insight rows. None of those prompts, workers, APIs, environment settings or provider code is changed or invoked by Brand Watch.

Brand Watch therefore uses its own small `BrandWatchAITransport` interface and bounded structured-output runner rather than calling the existing unbounded wrapper. Callers supply code-owned provider/model identities and a generator that respects AbortSignal, keeps system/trusted-context/source-data messages separate, disables hidden retries and honors the requested output/schema limits. An opt-in `createGeminiEvidenceTransport` REST factory accepts explicit API key/model dependencies, with no environment lookup or request at construction/import. It sends credentials only in a header, forbids redirects, separates instruction/data parts, requests one schema-constrained candidate, caps response-envelope bytes and returns typed refusal/truncation/status failures. Its `responseFormat.text` contract follows the current [Google GenerateContent API](https://ai.google.dev/api/generate-content). Mock HTTP verifies the actual request/response mapping; no real credentials or live requests were used. No automatic Claude/OpenAI SDK fallback is installed. Live caller/entrypoint binding is a separate authorized integration step. Configured transport order is caller-owned, not read from source content.

Default maximum is two attempts with a 20s per-attempt timeout (ceiling 30s). Only NETWORK/TIMEOUT may advance to the next configured slot. RATE_LIMIT/429, MALFORMED_OUTPUT, SCHEMA_FAILURE, SAFETY_REFUSAL and non-retryable PROVIDER_ERROR stop immediately. There is no regeneration/fallback after failed support validation. No sleep loop, global cooldown or automatic retry exists. Returned attempts contain only provider/model and safe result codes; raw responses, source bodies, SDK error payloads and credentials are not logged.

### Prompt, validation and Evidence acceptance

Versions: `evidence-v1`, `evidence-movement-v1`, support normalizer `support-v1`, deterministic assembly `movement-assembly-v1`. The evidence prompt requests role/relevance assessments and single-fact Evidence candidates in one bounded response; Movement assembly is deterministic and has no separate LLM prompt/call. Zod strict objects reject unknown fields, unregistered slugs, unsupported taxonomy and malformed field types. Empty evidence is valid. Maximums: ten Evidence items, five role assessments, 300 characters per supporting span, 4,000 requested output tokens and 24KB returned JSON. Output is parsed as complete JSON; markdown/prose extraction is deliberately not attempted.

System instructions, trusted registry context and SOURCE_DATA are separate request fields. Source title/text/author/metadata/URLs are only in a JSON data envelope, with XML delimiter characters and Unicode line separators escaped. Source text is limited to 20,000 characters; metadata to ten fields/500 characters each; source URL to 2,000 characters. Truncated body inputs cannot produce assembly/storage-eligible Evidence without review. Metadata truncation is flagged separately. Source data cannot select a provider/model, add tools, create entities or override instructions.

Evidence has local response key, controlled entity slug/fact type/movement type, one fact, optional source-backed event name/date, short support, title/text locator, relevance/role candidates and confidence with basis. Dates never fall back to publication/collection dates. Supported date proof uses explicit ISO/numeric/Korean day expressions; unresolved/partial dates remain unknown or require review. Unknown external entities remain source-backed names only, never registry seeds.

Support checking applies NFKC, collapsed whitespace, common HTML entity decoding and typographic quote/dash normalization. It does not use fuzzy acceptance, strip arbitrary content or remove numeric punctuation. A support span must exist in the claimed title/text field. Derived locator offsets refer to the **normalized field**, with normalization version and source content hash, not guessed raw-string offsets. Fact numeric tokens must occur in support; event day and event name must also be supported by the quoted span. Role assessment must agree, direct-actor support must mention the entity, and reporting/introduction or related-entity boundary ambiguity blocks assembly until review.

These checks establish textual support, **not semantic entailment, verified truth or final actor identity**. Every Evidence remains `needs_review`; unsupported items retain explicit issues such as INVALID_SUPPORT, UNSUPPORTED_NUMBER/DATE/ACTOR or ENTITY_ROLE_CONFLICT and cannot assemble/store. Even valid spans require human review. Confidence is an uncalibrated model triage signal capped at 0.75, never a truth probability or automatic approval criterion.

The prefilter may assess all articles by default. `skipLikelyIrrelevant=true` is an explicit cost policy, not permanent deletion/rejection. AI irrelevant assessments return no Evidence and retain rationale/exclusion metadata as an unreviewed assessment. Conflicting relevance, ambiguous actors and uncertain evidence never become published facts.

### Movement identity and source independence

Assembly requires a registry-matched entity, locally valid source-backed Evidence, a primary/secondary **candidate** role, a non-irrelevant relevance candidate, no exclusion reason and controlled movement type. Mentioned-only, invalid, truncated or cross-entity Evidence is excluded. Supported facts sharing named event/type/day can form one candidate; unnamed facts remain separate until identity review. Title/summary reuse supported event name/fact rather than inventing editorial interpretation. Scope is null and market/channel empty until explicitly supplied by review; day-only dates are not converted to invented midnight event timestamps.

Clustering compares same entity/type, explicit named event, event-day distance and deterministic title-token Jaccard similarity. Matching entity/type/name/day produces SAME_EVENT_HIGH, which can attach Evidence to a single unreviewed candidate copy. Missing dates with the same event name or very similar title, type disagreement with the same name, or title/date proximity produce review-required POSSIBLY_SAME. Conflicting names, different entities or days more than seven apart remain separate. Multiple plausible targets require merge review. A strong candidate match is not proof that all activations are one event; review can split them. Published/approved targets are rejected by the candidate schema and cannot be updated.

Source independence is a separate review-required signal. Same provider/domain/canonical version, identical content hash/body, near-duplicate body or shared declared source origin yields NOT_INDEPENDENT. Otherwise the result is only POSSIBLY_INDEPENDENT, with official/media flags and measured body similarity. Untrusted declared origins can lower independence, never establish verified independence. Article/provider counts and clustered source count must not be promoted into independent corroboration automatically. Assessment results are returned in the cluster result; durable review decisions/Pattern coverage computation are Phase 4.

### Existing-schema storage preparation

`preparePendingEvidence` and `prepareDraftMovement` prepare rows only; they neither create clients nor execute mutations. They revalidate support, registry identity, source hash and evidence/source closure before returning a plan. Evidence maps to 018 `review_status=pending`, `status=active`; source entity matches retain `role=mentioned`, `review_status=pending`, with the AI role proposal recorded only in extraction metadata. Movement maps to `status=draft`, not approved/published; scope/market/channel/importance must be explicitly supplied by a reviewing caller. Dates remain in Evidence; `started_at` is null when only an event day is known.

Provider/model, prompt/pipeline versions and trusted generation time map to generation columns/created_at. The text `support_locator` stores a JSON locator envelope including validation method and extraction metadata (provider/model/time/fact type/movement type/event name/role/relevance candidates/confidence basis). Relevance numeric storage values 1/0.5/0 encode relevant/uncertain/irrelevant categories; they are internal weights, not measured probabilities. No migration or API contract is changed. The actual 018 SQL fixture verifies pending rows and draft junctions, and rejects publication without approved primary-action review.

Phase 4 remains responsible for authorized atomic storage/review commands, role approval, source-independence adjudication, merge/split/correction audit transactions, live caller/credential binding, Pattern/Take/Snapshot, admin review UI and public eligibility. All provider verification states from Phase 2 remain unchanged. See `brand-watch-evidence-sample.md` for the exercised synthetic fact-to-source trace.

## Phase 4A: human review commands

Migration `019_brand_watch_review_commands.sql` (LOCAL ONLY, not applied to production) adds seven review functions and no tables, columns or triggers. Each function locks its target rows, validates the transition, changes state and relations, and appends one `brand_watch_review_events` row in the caller's transaction; any failure, including 018's deferred publication check at commit, rolls back everything. Execution is granted to `service_role` only. `src/lib/brand-watch/review/commands.ts` validates strict command schemas (non-blank actor ≤200 and reason ≤1000, also enforced in SQL), calls the matching RPC through an injected client and returns typed error codes only, never database messages. Actor must come from the server-side admin identity. No route, UI or automatic caller invokes these commands yet.

| Command | Allowed transition | Relations |
| --- | --- | --- |
| evidence approve | pending/active → approved | Reviewer sets the source×entity match role and approves it; a different already-approved role fails (`MATCH_ROLE_CONFLICT`) |
| evidence reject | pending/active → rejected | — (approved evidence is corrected by supersede, never rejected) |
| evidence supersede | approved/active → superseded | New pending manual successor with `supersedes_id` and correction reason; one successor only |
| movement approve | draft → published | 018 trigger requires approved primary-action evidence (`PUBLICATION_REQUIREMENTS_UNMET`) |
| movement reject | draft → withdrawn | — |
| movement supersede | published → superseded | New draft successor with a new `event_key` and given same-entity, active, non-rejected evidence |
| movement merge | draft/published source → superseded | `merged_into_id` = target. Source links are never removed. A draft target gains the source's active, non-rejected evidence links; a published target's links are frozen, so its merged lineage is reached through `merged_into_id` |

018 has no movement `supersedes_id`, so `merged_into_id` is the successor pointer for both supersede and merge; the review event action distinguishes them. Repeating a merge into the same target is an idempotent no-op with no second event; merging an already-merged source elsewhere, into a superseded/withdrawn target, across entities or into itself fails. Both rows are locked in id order. Downstream impact of superseded evidence/movements on published analyses, withdraw/unpublish, split, Pattern/Take/Snapshot and admin UI remain Phase 4B–5.

## Phase 4B: observed pattern engine

Layers: **Movement = FACT layer** (Source → Evidence → Movement, human-approved). **Pattern = OBSERVED PATTERN**: recurring marketing activity across separate approved Movements of one brand, described without strategy, intent, forecast or significance. **Take = not yet implemented** (interpretation, Phase 4C).

`src/lib/brand-watch/patterns/` is a manual pure pipeline with an injected transport; no route, job, write or publish path exists. `assessPatternEligibility` admits only Movements that are `published` (approved via 4A), not merged/superseded/withdrawn, of the requested entity, with non-empty lineage whose Evidence is all approved/active/same-entity with an approved primary actor match, none irrelevant and at least one relevant, and an event day (or flagged observation fallback) inside `policy.recencyDays`. Excluded Movements carry reasons.

`countIndependence` counts conservatively. Movements sharing an event key or Evidence, or with the same type, title similarity ≥ policy and event days within policy distance, are one event (`independentMovementCount`). Sources sharing provider, content hash or canonical URL are one publisher (`independentSourceCount`, separate from `sourceItemCount`). Five reports of one event are one Movement. Fewer than `minIndependentMovements` (policy, never below 2) stops before any AI call.

The `pattern-v1` prompt (pipeline `pattern-engine-v1`) reuses the Phase 3 bounded `runStructuredAI`/`BrandWatchAITransport`; the transport request type was widened to a shared `BrandWatchAIRequest` without behavior change. Input is eligible Movements, their approved Evidence facts and source metadata only, never source bodies; eligible IDs are trusted context, the data is an escaped untrusted envelope. The strict schema rejects unknown fields and allows at most three patterns. A pattern citing a non-existent or ineligible Movement, unreachable Evidence, fewer than the minimum independent events, or strategy/intent/forecast wording is rejected individually. Candidates are always `needs_review` with confidence capped at 0.75, computed counts, `windowStart`/`windowEnd` from reviewed event days, `lastSupportingMovementAt` from the latest observation, deterministic plus AI uncertainties and full provenance. Only mock transports were used.

`classifyPatternCandidate` compares Movement-set overlap and title similarity with same-entity draft/published patterns: `NEW`, `POSSIBLE_DUPLICATE` (identical or ambiguous overlap, or overlap with a draft), or `REVISION_CANDIDATE` (unambiguous strict extension of one published pattern). `preparePatternDraft` prepares 018 `brand_patterns` + `pattern_movements` rows with `status=draft` only. A revision is a new successor with `supersedes_id` and `revision+1`; 018 guards keep the predecessor untouched and reject a competing successor. Possible duplicates cannot be prepared. No migration was added. 018 has no columns for counts, uncertainties or `lastSupportingMovementAt`; they are recomputed from lineage. Atomic persistence/review of patterns, stale propagation, Take, Snapshot and admin UI remain later phases.
