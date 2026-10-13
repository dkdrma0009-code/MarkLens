import { lineageGraphSchema, type LineageGraph } from "./health"

// Raw 018/020 rows as PostgREST/supabase-js returns them (snake_case, ISO timestamps, numeric as number).
type Id = string
export interface LineageRows {
  movements: { id: Id; entity_id: Id; event_key: string; title: string; summary: string; movement_type: string; status: string; merged_into_id: Id | null; started_at: string | null; last_observed_at: string | null }[]
  movementEvidence: { movement_id: Id; evidence_id: Id }[]
  evidence: { id: Id; entity_id: Id; source_item_id: Id; fact: string; event_date: string | null; review_status: string; status: string; marketing_relevance: number | string }[]
  sources: { id: Id; provider_id: Id; canonical_url: string; content_hash: string; published_at: string | null }[]
  providers: { id: Id; provider_type: string }[]
  matches: { source_item_id: Id; entity_id: Id; role: string; review_status: string }[]
  patterns: { id: Id; entity_id: Id; title: string; description: string; window_start: string; window_end: string; status: string; revision: number }[]
  patternMovements: { pattern_id: Id; movement_id: Id }[]
  takes: { id: Id; entity_id: Id; pattern_id: Id; status: string; revision: number; what_we_see: string; why_it_may_matter: string; what_to_watch_next: string }[]
  takeEvidence: { take_id: Id; evidence_id: Id }[]
  snapshots: { id: Id; entity_id: Id; status: string; revision: number; valid_from: string; evidence_count: number; source_count: number }[]
  snapshotTakes: { snapshot_id: Id; take_id: Id }[]
}

const byId = <T extends { id: Id }>(rows: readonly T[]) => new Map(rows.map(row => [row.id, row]))
const sortedIds = (values: Iterable<Id>) => [...new Set(values)].sort()

// Pure transformation into the evaluateLineageHealth graph. Only rows of the requested entity are kept.
export function buildLineageGraph(entityId: Id, rows: LineageRows): LineageGraph {
  const evidence = byId(rows.evidence), sources = byId(rows.sources), providers = byId(rows.providers)
  const matches = new Map(rows.matches.filter(row => row.entity_id === entityId).map(row => [row.source_item_id, row]))
  const own = <T extends { entity_id: Id; id: Id }>(list: readonly T[]) => list.filter(row => row.entity_id === entityId).sort((a, b) => a.id.localeCompare(b.id))
  const links = <T>(list: readonly T[], key: keyof T, value: Id, target: keyof T) => sortedIds(list.filter(row => row[key] === value).map(row => row[target] as Id))
  return lineageGraphSchema.parse({
    movements: own(rows.movements).map(m => ({
      id: m.id, entityId: m.entity_id, eventKey: m.event_key, title: m.title, summary: m.summary, movementType: m.movement_type, status: m.status, mergedIntoId: m.merged_into_id, startedAt: m.started_at, lastObservedAt: m.last_observed_at,
      evidence: links(rows.movementEvidence, "movement_id", m.id, "evidence_id").flatMap(evidenceId => {
        const e = evidence.get(evidenceId), source = e && sources.get(e.source_item_id), match = e && matches.get(e.source_item_id)
        if (!e || !source || e.entity_id !== entityId) return []
        return [{ id: e.id, entityId: e.entity_id, sourceItemId: e.source_item_id, fact: e.fact, eventDate: e.event_date, reviewStatus: e.review_status, status: e.status, marketingRelevance: Number(e.marketing_relevance), matchRole: match?.role ?? null, matchReviewStatus: match?.review_status ?? null,
          source: { providerId: source.provider_id, providerType: providers.get(source.provider_id)?.provider_type, canonicalUrl: source.canonical_url, contentHash: source.content_hash, publishedAt: source.published_at } }]
      }),
    })),
    patterns: own(rows.patterns).map(p => ({ id: p.id, entityId: p.entity_id, title: p.title, description: p.description, windowStart: p.window_start, windowEnd: p.window_end, status: p.status, revision: p.revision, movementIds: links(rows.patternMovements, "pattern_id", p.id, "movement_id") })),
    takes: own(rows.takes).map(t => ({ id: t.id, entityId: t.entity_id, patternId: t.pattern_id, status: t.status, revision: t.revision, whatWeSee: t.what_we_see, whyItMayMatter: t.why_it_may_matter, whatToWatchNext: t.what_to_watch_next, evidenceIds: links(rows.takeEvidence, "take_id", t.id, "evidence_id") })),
    snapshots: own(rows.snapshots).map(s => ({ id: s.id, entityId: s.entity_id, status: s.status, revision: s.revision, asOf: s.valid_from, takeIds: links(rows.snapshotTakes, "snapshot_id", s.id, "take_id"), evidenceCount: s.evidence_count, sourceCount: s.source_count })),
  })
}

// The read-only subset of the supabase-js query builder this loader uses (from → select → in).
export interface LineageQueryClient {
  from(table: string): { select(columns: string): { in(column: string, values: readonly string[]): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } }
}

// Read-only DB queries for one entity; database messages never leave this function.
export async function loadLineageRows(client: LineageQueryClient, entityId: Id): Promise<LineageRows> {
  const query = async <T>(table: string, columns: string, column: string, values: readonly Id[]) => {
    if (!values.length) return [] as T[]
    const { data, error } = await client.from(table).select(columns).in(column, sortedIds(values))
    if (error) throw new Error("LINEAGE_LOAD_FAILED")
    return (data ?? []) as T[]
  }
  type R = LineageRows
  const [movements, patterns, takes, snapshots] = await Promise.all([
    query<R["movements"][number]>("brand_movements", "id,entity_id,event_key,title,summary,movement_type,status,merged_into_id,started_at,last_observed_at", "entity_id", [entityId]),
    query<R["patterns"][number]>("brand_patterns", "id,entity_id,title,description,window_start,window_end,status,revision", "entity_id", [entityId]),
    query<R["takes"][number]>("brand_takes", "id,entity_id,pattern_id,status,revision,what_we_see,why_it_may_matter,what_to_watch_next", "entity_id", [entityId]),
    query<R["snapshots"][number]>("brand_snapshots", "id,entity_id,status,revision,valid_from,evidence_count,source_count", "entity_id", [entityId]),
  ])
  const [movementEvidence, patternMovements, takeEvidence, snapshotTakes] = await Promise.all([
    query<R["movementEvidence"][number]>("movement_evidence", "movement_id,evidence_id", "movement_id", movements.map(row => row.id)),
    query<R["patternMovements"][number]>("pattern_movements", "pattern_id,movement_id", "pattern_id", patterns.map(row => row.id)),
    query<R["takeEvidence"][number]>("take_evidence", "take_id,evidence_id", "take_id", takes.map(row => row.id)),
    query<R["snapshotTakes"][number]>("snapshot_takes", "snapshot_id,take_id", "snapshot_id", snapshots.map(row => row.id)),
  ])
  const evidence = await query<R["evidence"][number]>("brand_evidence", "id,entity_id,source_item_id,fact,event_date,review_status,status,marketing_relevance", "id", movementEvidence.map(row => row.evidence_id))
  const sourceIds = evidence.map(row => row.source_item_id)
  const [sources, matches] = await Promise.all([
    query<R["sources"][number]>("source_items", "id,provider_id,canonical_url,content_hash,published_at", "id", sourceIds),
    query<R["matches"][number]>("source_entity_matches", "source_item_id,entity_id,role,review_status", "source_item_id", sourceIds),
  ])
  const providers = await query<R["providers"][number]>("source_providers", "id,provider_type", "id", sources.map(row => row.provider_id))
  return { movements, movementEvidence, evidence, sources, providers, matches, patterns, patternMovements, takes, takeEvidence, snapshots, snapshotTakes }
}

export async function loadLineageGraph(client: LineageQueryClient, entityId: Id) {
  return buildLineageGraph(entityId, await loadLineageRows(client, entityId))
}
