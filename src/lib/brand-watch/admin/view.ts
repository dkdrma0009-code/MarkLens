import { evaluateLineageHealth, type HealthResult, type LineageGraph, type LineageHealth } from "../lifecycle/health"
import { buildLineageGraph } from "../lifecycle/load"
import { lifecyclePolicySchema } from "../lifecycle/policy"
import { countIndependence, movementOccurrence } from "../patterns/eligibility"
import { textSimilarity } from "../movements/independence"
import { launchRegistry } from "../registry"
import { sourceRegistry } from "../sources/registry"
import type { AdminRows } from "./queries"
import { NEW_SOURCE_WINDOW_DAYS } from "./constants"

// Pure Admin read model. Every number is derived from loaded rows; absent data stays empty or zero.
export type HealthView = Pick<HealthResult, "health" | "reasons" | "causes" | "action"> | null
export type Relevance = "relevant" | "uncertain" | "irrelevant" | "unassessed"
export interface EntityView { id: string; slug: string; name: string; nameKo: string; entityType: string; inDatabase: boolean; aliases: string[]; watchStatus: string | null; publicStatus: string | null; seoStatus: string | null; lastMeaningfulUpdateAt: string | null; lastReviewedAt: string | null; currentSnapshotId: string | null; healthSummary: Record<LineageHealth, number> | null; latestMovementAt: string | null }
export interface EvidenceView { id: string; entityId: string; sourceItemId: string; fact: string; supportText: string | null; eventDate: string | null; reviewStatus: string; status: string; relevance: Relevance; confidence: number; matchRole: string | null; matchReviewStatus: string | null; roleCandidate: string | null; validation: string | null; extractionMethod: string; model: string | null; promptVersion: string | null; supersedesId: string | null; correctionReason: string | null; createdAt: string; movementIds: string[] }
export interface SourceView { id: string; title: string; providerId: string; providerName: string; providerType: string; originalUrl: string; canonicalUrl: string; publishedAt: string | null; datePrecision: string; collectedAt: string; author: string | null; status: string; contentHash: string; rightsBasis: string | null; retentionUntil: string | null; entityIds: string[]; matches: { entityId: string; role: string; reviewStatus: string; method: string }[]; evidenceIds: string[]; reviewState: "needs_review" | "reviewed" | "no_evidence"; relevance: Relevance }
export interface MovementView { id: string; entityId: string; eventKey: string; title: string; summary: string; movementType: string; scope: string; market: string[]; channel: string[]; importance: number; status: string; mergedIntoId: string | null; occurredOn: string | null; lastObservedAt: string | null; evidenceIds: string[]; sourceItemIds: string[]; independentSourceCount: number; health: HealthView; related: { id: string; titleSimilarity: number; sameType: boolean; dayDistance: number | null }[]; mergeTargetIds: string[] }
export interface PatternView { id: string; entityId: string; title: string; description: string; windowStart: string; windowEnd: string; status: string; revision: number; supersedesId: string | null; confidence: number; uncertainties: string[]; movementIds: string[]; independentMovementCount: number; independentSourceCount: number; model: string | null; promptVersion: string | null; createdAt: string; health: HealthView }
export interface TakeView { id: string; entityId: string; patternId: string; whatWeSee: string; whyItMayMatter: string; whatToWatchNext: string; status: string; revision: number; supersedesId: string | null; confidence: number | null; uncertainties: string[]; evidenceIds: string[]; model: string | null; createdAt: string; health: HealthView }
export interface SnapshotView { id: string; entityId: string; headline: string; currentDirection: string; watchNext: string | null; asOf: string; status: string; revision: number; supersedesId: string | null; reviewedBy: string | null; reviewedAt: string | null; evidenceCount: number; sourceCount: number; confidence: number | null; uncertainties: string[]; takeIds: string[]; patternIds: string[]; movementIds: string[]; isCurrent: boolean; model: string | null; createdAt: string; health: HealthView }
export interface EventView { id: string; targetType: string; targetId: string; action: string; actor: string; reason: string; occurredAt: string; revision: number | null }
export interface ProviderView { key: string; name: string; domain: string; entitySlug: string | null; providerType: string; verification: string | null; robotsConfirmed: boolean | null; verifiedAt: string | null; verificationNote: string | null; adapter: string | null; inRegistry: boolean; inDatabase: boolean; active: boolean | null; ingestionMethod: string | null; latestCollectedAt: string | null; loadedSourceCount: number }
export interface AdminView {
  generatedAt: string; truncated: Partial<Record<string, boolean>>; healthUnavailableEntityIds: string[]
  kpis: { newSources: number; reviewNeeded: number; publishedMovements: number; staleSnapshots: number }
  entities: EntityView[]; sources: SourceView[]; evidence: EvidenceView[]; movements: MovementView[]
  patterns: PatternView[]; takes: TakeView[]; snapshots: SnapshotView[]; events: EventView[]; providers: ProviderView[]
}

const num = (value: number | string | null | undefined) => value === null || value === undefined ? null : Number(value)
const relevanceOf = (value: number | null): Relevance => value === null ? "unassessed" : value >= 1 ? "relevant" : value >= 0.5 ? "uncertain" : "irrelevant"
function locator(text: string | null) {
  try {
    const parsed = text ? JSON.parse(text) as { validation?: { result?: unknown }; extraction?: { entityRoleCandidate?: unknown } } : null
    return { validation: typeof parsed?.validation?.result === "string" ? parsed.validation.result : null, roleCandidate: typeof parsed?.extraction?.entityRoleCandidate === "string" ? parsed.extraction.entityRoleCandidate : null }
  } catch { return { validation: null, roleCandidate: null } }
}
const group = <T, K>(rows: readonly T[], key: (row: T) => K) => { const map = new Map<K, T[]>(); for (const row of rows) map.set(key(row), [...map.get(key(row)) ?? [], row]); return map }
const byDesc = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "")

export function buildAdminView(rows: AdminRows, now: string, options: { truncated?: Partial<Record<string, boolean>>; policy?: unknown } = {}): AdminView {
  const policy = lifecyclePolicySchema.parse(options.policy ?? {})
  // Health per entity; an entity whose stored rows cannot be evaluated is reported, not hidden or faked.
  const health = new Map<string, HealthView>(), graphs = new Map<string, LineageGraph>(), summaries = new Map<string, Record<LineageHealth, number>>(), unavailable: string[] = []
  for (const entity of rows.entities) {
    try {
      const graph = buildLineageGraph(entity.id, rows), report = evaluateLineageHealth(graph, now, policy)
      graphs.set(entity.id, graph); summaries.set(entity.id, report.summary)
      for (const result of report.results) health.set(`${result.kind}:${result.id}`, { health: result.health, reasons: result.reasons, causes: result.causes, action: result.action })
    } catch { unavailable.push(entity.id) }
  }
  const graphMovement = new Map([...graphs.values()].flatMap(graph => graph.movements.map(row => [row.id, row] as const)))
  const providerById = new Map(rows.providers.map(row => [row.id, row]))
  const matchesBySource = group(rows.matches, row => row.source_item_id), evidenceBySource = group(rows.evidence, row => row.source_item_id)
  const movementsByEvidence = group(rows.movementEvidence, row => row.evidence_id), evidenceByMovement = group(rows.movementEvidence, row => row.movement_id)
  const evidenceById = new Map(rows.evidence.map(row => [row.id, row]))

  const evidence: EvidenceView[] = rows.evidence.map(row => {
    const match = matchesBySource.get(row.source_item_id)?.find(m => m.entity_id === row.entity_id), meta = locator(row.support_locator)
    return { id: row.id, entityId: row.entity_id, sourceItemId: row.source_item_id, fact: row.fact, supportText: row.support_text, eventDate: row.event_date, reviewStatus: row.review_status, status: row.status, relevance: relevanceOf(num(row.marketing_relevance)), confidence: Number(row.confidence), matchRole: match?.role ?? null, matchReviewStatus: match?.review_status ?? null, roleCandidate: meta.roleCandidate, validation: meta.validation, extractionMethod: row.extraction_method, model: row.generation_model, promptVersion: row.prompt_version, supersedesId: row.supersedes_id, correctionReason: row.correction_reason, createdAt: row.created_at, movementIds: (movementsByEvidence.get(row.id) ?? []).map(link => link.movement_id) }
  })
  const evidenceViewById = new Map(evidence.map(row => [row.id, row]))

  const sources: SourceView[] = rows.sources.map((row): SourceView => {
    const own = (evidenceBySource.get(row.id) ?? []).map(e => evidenceViewById.get(e.id)!).filter(Boolean), matches = matchesBySource.get(row.id) ?? []
    const pending = own.some(e => e.reviewStatus === "pending" && e.status === "active") || matches.some(m => m.review_status === "pending")
    const relevance = own.length ? (["relevant", "uncertain", "irrelevant"] as const).find(level => own.some(e => e.relevance === level)) ?? "unassessed" : "unassessed"
    const provider = providerById.get(row.provider_id)
    return { id: row.id, title: row.title, providerId: row.provider_id, providerName: provider?.name ?? "Unknown provider", providerType: provider?.provider_type ?? "unknown", originalUrl: row.original_url, canonicalUrl: row.canonical_url, publishedAt: row.published_at, datePrecision: row.date_precision, collectedAt: row.collected_at, author: row.author, status: row.status, contentHash: row.content_hash, rightsBasis: row.rights_basis, retentionUntil: row.retention_until,
      entityIds: [...new Set([...matches.map(m => m.entity_id), ...own.map(e => e.entityId)])], matches: matches.map(m => ({ entityId: m.entity_id, role: m.role, reviewStatus: m.review_status, method: m.method })),
      evidenceIds: own.map(e => e.id), reviewState: pending ? "needs_review" : own.length ? "reviewed" : "no_evidence", relevance }
  }).sort((a, b) => byDesc(a.collectedAt, b.collectedAt))

  const occurrence = (row: AdminRows["movements"][number]) => movementOccurrence({ startedAt: row.started_at, lastObservedAt: row.last_observed_at, evidence: (evidenceByMovement.get(row.id) ?? []).map(link => ({ eventDate: evidenceById.get(link.evidence_id)?.event_date ?? null })) } as never)
  const movements: MovementView[] = rows.movements.map(row => {
    const evidenceIds = (evidenceByMovement.get(row.id) ?? []).map(link => link.evidence_id), occurredOn = occurrence(row)?.occurredOn ?? null
    const graph = graphMovement.get(row.id)
    const independentSourceCount = graph ? countIndependence([{ movement: graph, occurredOn: occurredOn ?? "1970-01-01", dateBasis: "event" }], policy).independentSourceCount : 0
    const peers = rows.movements.filter(other => other.entity_id === row.entity_id && other.id !== row.id && (other.status === "draft" || other.status === "published") && !other.merged_into_id)
    const related = peers.map(other => {
      const otherDay = occurrence(other)?.occurredOn ?? null
      return { id: other.id, titleSimilarity: Math.round(textSimilarity(row.title, other.title) * 100) / 100, sameType: other.movement_type === row.movement_type, dayDistance: occurredOn && otherDay ? Math.abs(Date.parse(occurredOn) - Date.parse(otherDay)) / 86400000 : null }
    }).filter(signal => signal.titleSimilarity >= 0.6 || (signal.sameType && signal.titleSimilarity >= 0.3 && (signal.dayDistance ?? Infinity) <= policy.sameEventMaxDayDistance)).sort((a, b) => b.titleSimilarity - a.titleSimilarity).slice(0, 5)
    return { id: row.id, entityId: row.entity_id, eventKey: row.event_key, title: row.title, summary: row.summary, movementType: row.movement_type, scope: row.scope, market: row.market ?? [], channel: row.channel ?? [], importance: row.importance, status: row.status, mergedIntoId: row.merged_into_id, occurredOn, lastObservedAt: row.last_observed_at,
      evidenceIds, sourceItemIds: [...new Set(evidenceIds.map(id => evidenceById.get(id)?.source_item_id).filter((id): id is string => Boolean(id)))], independentSourceCount, health: health.get(`movement:${row.id}`) ?? null, related, mergeTargetIds: peers.map(other => other.id) }
  }).sort((a, b) => byDesc(a.occurredOn ?? a.lastObservedAt, b.occurredOn ?? b.lastObservedAt))

  const linksOf = <T>(list: readonly T[], key: keyof T, value: string, target: keyof T) => list.filter(row => row[key] === value).map(row => row[target] as string)
  const patterns: PatternView[] = rows.patterns.map(row => {
    const movementIds = linksOf(rows.patternMovements, "pattern_id", row.id, "movement_id")
    const entries = movementIds.map(id => graphMovement.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m)).map(movement => ({ movement, ...(movementOccurrence(movement) ?? { occurredOn: row.window_start, dateBasis: "observed" as const }) }))
    const counts = countIndependence(entries, policy)
    return { id: row.id, entityId: row.entity_id, title: row.title, description: row.description, windowStart: row.window_start, windowEnd: row.window_end, status: row.status, revision: row.revision, supersedesId: row.supersedes_id, confidence: Number(row.confidence), uncertainties: row.uncertainties ?? [], movementIds, independentMovementCount: counts.independentMovementCount, independentSourceCount: counts.independentSourceCount, model: row.generation_model, promptVersion: row.prompt_version, createdAt: row.created_at, health: health.get(`pattern:${row.id}`) ?? null }
  }).sort((a, b) => byDesc(a.createdAt, b.createdAt))
  const takes: TakeView[] = rows.takes.map(row => ({ id: row.id, entityId: row.entity_id, patternId: row.pattern_id, whatWeSee: row.what_we_see, whyItMayMatter: row.why_it_may_matter, whatToWatchNext: row.what_to_watch_next, status: row.status, revision: row.revision, supersedesId: row.supersedes_id, confidence: num(row.confidence), uncertainties: row.uncertainties ?? [], evidenceIds: linksOf(rows.takeEvidence, "take_id", row.id, "evidence_id"), model: row.generation_model, createdAt: row.created_at, health: health.get(`take:${row.id}`) ?? null })).sort((a, b) => byDesc(a.createdAt, b.createdAt))
  const profiles = new Map(rows.profiles.map(row => [row.entity_id, row]))
  const snapshots: SnapshotView[] = rows.snapshots.map(row => {
    const takeIds = linksOf(rows.snapshotTakes, "snapshot_id", row.id, "take_id"), patternIds = [...new Set(takeIds.map(id => rows.takes.find(t => t.id === id)?.pattern_id).filter((id): id is string => Boolean(id)))]
    return { id: row.id, entityId: row.entity_id, headline: row.headline, currentDirection: row.body, watchNext: row.watch_next, asOf: row.valid_from, status: row.status, revision: row.revision, supersedesId: row.supersedes_id, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at, evidenceCount: row.evidence_count, sourceCount: row.source_count, confidence: num(row.confidence), uncertainties: row.uncertainties ?? [], takeIds, patternIds, movementIds: [...new Set(patternIds.flatMap(id => linksOf(rows.patternMovements, "pattern_id", id, "movement_id")))], isCurrent: profiles.get(row.entity_id)?.current_snapshot_id === row.id, model: row.generation_model, createdAt: row.created_at, health: health.get(`snapshot:${row.id}`) ?? null }
  }).sort((a, b) => byDesc(a.createdAt, b.createdAt))

  const revisions = new Map<string, number>([...rows.patterns, ...rows.takes, ...rows.snapshots].map(row => [row.id, row.revision]))
  const events: EventView[] = rows.events.map(row => ({ id: row.id, targetType: row.target_type, targetId: row.target_id, action: row.action, actor: row.actor, reason: row.reason, occurredAt: row.occurred_at, revision: revisions.get(row.target_id) ?? null })).sort((a, b) => byDesc(a.occurredAt, b.occurredAt))

  const dbEntities = new Map(rows.entities.map(row => [row.slug, row]))
  const entities: EntityView[] = [
    ...rows.entities.map(row => ({ row, registry: launchRegistry.find(entry => entry.slug === row.slug) })),
    ...launchRegistry.filter(entry => !dbEntities.has(entry.slug)).map(registry => ({ row: null, registry })),
  ].map(({ row, registry }) => {
    const id = row?.id ?? registry!.entity.id, profile = row ? profiles.get(row.id) : undefined
    return { id, slug: row?.slug ?? registry!.slug, name: row?.name ?? registry!.name, nameKo: row?.name_ko ?? registry!.nameKo, entityType: row?.entity_type ?? registry!.entity.entityType, inDatabase: Boolean(row), aliases: row ? rows.aliases.filter(a => a.entity_id === id).map(a => a.alias) : [...registry!.aliases],
      watchStatus: profile?.watch_status ?? null, publicStatus: profile?.public_status ?? null, seoStatus: profile?.seo_status ?? null, lastMeaningfulUpdateAt: profile?.last_meaningful_update_at ?? null, lastReviewedAt: profile?.last_reviewed_at ?? null, currentSnapshotId: profile?.current_snapshot_id ?? null,
      healthSummary: summaries.get(id) ?? null, latestMovementAt: movements.find(m => m.entityId === id)?.occurredOn ?? null }
  })

  const dbProviders = new Map(rows.providers.map(row => [row.domain, row]))
  const sourceStats = (providerId: string | undefined) => { const own = sources.filter(s => s.providerId === providerId); return { latestCollectedAt: own[0]?.collectedAt ?? null, loadedSourceCount: own.length } }
  const providers: ProviderView[] = [
    ...sourceRegistry.map(entry => { const db = dbProviders.get(entry.domain); return { key: entry.key, name: entry.name, domain: entry.domain, entitySlug: entry.entitySlug, providerType: entry.providerType, verification: entry.verification, robotsConfirmed: entry.robotsConfirmed, verifiedAt: entry.verifiedAt, verificationNote: entry.verificationNote, adapter: entry.adapter, inRegistry: true, inDatabase: Boolean(db), active: db?.active ?? null, ingestionMethod: db?.ingestion_method ?? null, ...sourceStats(db?.id) } }),
    ...rows.providers.filter(row => !sourceRegistry.some(entry => entry.domain === row.domain)).map(row => ({ key: row.id, name: row.name, domain: row.domain, entitySlug: null, providerType: row.provider_type, verification: null, robotsConfirmed: null, verifiedAt: null, verificationNote: null, adapter: null, inRegistry: false, inDatabase: true, active: row.active, ingestionMethod: row.ingestion_method, ...sourceStats(row.id) })),
  ]

  const since = new Date(Date.parse(now) - NEW_SOURCE_WINDOW_DAYS * 86400000).toISOString()
  const kpis = {
    newSources: sources.filter(s => Date.parse(s.collectedAt) >= Date.parse(since)).length,
    reviewNeeded: evidence.filter(e => e.reviewStatus === "pending" && e.status === "active").length + [...movements, ...patterns, ...takes, ...snapshots].filter(row => row.status === "draft").length,
    publishedMovements: movements.filter(m => m.status === "published" && !m.mergedIntoId).length,
    staleSnapshots: snapshots.filter(s => s.status === "published" && s.health && s.health.health !== "HEALTHY").length,
  }
  return { generatedAt: now, truncated: options.truncated ?? {}, healthUnavailableEntityIds: unavailable, kpis, entities, sources, evidence, movements, patterns, takes, snapshots, events, providers }
}
