import type { LineageRows } from "../lifecycle/load"

// Read-only Admin row loading. Uses only the supabase-js query-builder subset below, so a service-role
// client can be passed on the server; nothing here mutates or is sent to the browser.
export interface AdminQueryBuilder extends PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  in(column: string, values: readonly unknown[]): AdminQueryBuilder
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): AdminQueryBuilder
  limit(count: number): AdminQueryBuilder
}
export interface AdminQueryClient { from(table: string): { select(columns: string): AdminQueryBuilder } }

type Id = string
export interface AdminRows extends LineageRows {
  entities: { id: Id; slug: string; name: string; name_ko: string; entity_type: string; category: string; status: string }[]
  aliases: { entity_id: Id; alias: string; alias_type: string; language: string }[]
  profiles: { entity_id: Id; watch_status: string; public_status: string; seo_status: string; last_meaningful_update_at: string | null; last_reviewed_at: string | null; current_snapshot_id: Id | null }[]
  providers: (LineageRows["providers"][number] & { name: string; domain: string; source_tier: number; active: boolean; ingestion_method: string })[]
  sources: (LineageRows["sources"][number] & { original_url: string; title: string; date_precision: string; author: string | null; status: string; collected_at: string; rights_basis: string | null; retention_until: string | null; image_url: string | null })[]
  matches: (LineageRows["matches"][number] & { method: string; confidence: number | string })[]
  evidence: (LineageRows["evidence"][number] & { support_text: string | null; support_locator: string | null; date_precision: string; confidence: number | string; extraction_method: string; supersedes_id: Id | null; correction_reason: string | null; generation_model: string | null; prompt_version: string | null; created_at: string })[]
  movements: (LineageRows["movements"][number] & { scope: string; market: string[]; channel: string[]; importance: number; created_at: string })[]
  patterns: (LineageRows["patterns"][number] & { confidence: number | string; uncertainties: string[] | null; supersedes_id: Id | null; generation_model: string | null; prompt_version: string | null; created_at: string })[]
  takes: (LineageRows["takes"][number] & { confidence: number | string | null; uncertainties: string[] | null; supersedes_id: Id | null; generation_model: string | null; created_at: string })[]
  snapshots: (LineageRows["snapshots"][number] & { headline: string; body: string; watch_next: string | null; reviewed_by: string | null; reviewed_at: string | null; confidence: number | string | null; uncertainties: string[] | null; supersedes_id: Id | null; generation_model: string | null; created_at: string })[]
  events: { id: Id; target_type: string; target_id: Id; action: string; actor: string; reason: string; occurred_at: string }[]
}

export const ADMIN_LIMITS = { sources: 200, movements: 1000, patterns: 500, takes: 500, snapshots: 300, events: 500 } as const
const COLUMNS = {
  entities: "id,slug,name,name_ko,entity_type,category,status",
  aliases: "entity_id,alias,alias_type,language",
  profiles: "entity_id,watch_status,public_status,seo_status,last_meaningful_update_at,last_reviewed_at,current_snapshot_id",
  providers: "id,name,domain,provider_type,source_tier,active,ingestion_method",
  sources: "id,provider_id,canonical_url,original_url,title,published_at,date_precision,author,status,collected_at,content_hash,rights_basis,retention_until,image_url",
  matches: "source_item_id,entity_id,role,review_status,method,confidence",
  evidence: "id,entity_id,source_item_id,fact,support_text,support_locator,event_date,date_precision,marketing_relevance,confidence,extraction_method,review_status,status,supersedes_id,correction_reason,generation_model,prompt_version,created_at",
  movements: "id,entity_id,event_key,title,summary,movement_type,scope,market,channel,started_at,last_observed_at,importance,status,merged_into_id,created_at",
  patterns: "id,entity_id,title,description,window_start,window_end,confidence,uncertainties,revision,supersedes_id,status,generation_model,prompt_version,created_at",
  takes: "id,entity_id,pattern_id,what_we_see,why_it_may_matter,what_to_watch_next,confidence,uncertainties,revision,supersedes_id,status,generation_model,created_at",
  snapshots: "id,entity_id,headline,body,watch_next,valid_from,evidence_count,source_count,reviewed_by,reviewed_at,confidence,uncertainties,revision,supersedes_id,status,generation_model,created_at",
  events: "id,target_type,target_id,action,actor,reason,occurred_at",
}

export async function fetchBrandWatchAdminRows(client: AdminQueryClient): Promise<{ rows: AdminRows; truncated: Partial<Record<keyof typeof ADMIN_LIMITS, boolean>> }> {
  const run = async <T>(builder: AdminQueryBuilder) => {
    const { data, error } = await builder
    if (error) throw new Error("BRAND_WATCH_ADMIN_LOAD_FAILED")
    return (data ?? []) as T[]
  }
  // Chunked IN lookups keep PostgREST URLs bounded.
  const byIds = async <T>(table: keyof typeof COLUMNS, column: string, values: Iterable<Id>) => {
    const ids = [...new Set(values)], rows: T[] = []
    for (let start = 0; start < ids.length; start += 100) rows.push(...await run<T>(client.from(tableName[table]).select(COLUMNS[table]).in(column, ids.slice(start, start + 100))))
    return rows
  }
  const tableName: Record<keyof typeof COLUMNS, string> = { entities: "brand_entities", aliases: "brand_aliases", profiles: "brand_watch_profiles", providers: "source_providers", sources: "source_items", matches: "source_entity_matches", evidence: "brand_evidence", movements: "brand_movements", patterns: "brand_patterns", takes: "brand_takes", snapshots: "brand_snapshots", events: "brand_watch_review_events" }
  const recent = async <T>(table: keyof typeof COLUMNS, filterColumn: string, values: readonly unknown[], orderColumn: string, limit: number) =>
    values.length ? run<T>(client.from(tableName[table]).select(COLUMNS[table]).in(filterColumn, values).order(orderColumn, { ascending: false, nullsFirst: false }).limit(limit)) : [] as T[]
  type R = AdminRows

  const [entities, providers] = await Promise.all([
    run<R["entities"][number]>(client.from("brand_entities").select(COLUMNS.entities).in("status", ["active", "inactive"])),
    run<R["providers"][number]>(client.from("source_providers").select(COLUMNS.providers).in("active", [true, false])),
  ])
  const entityIds = entities.map(row => row.id)
  const [aliases, profiles, movements, patterns, takes, snapshots, queueSources, events] = await Promise.all([
    byIds<R["aliases"][number]>("aliases", "entity_id", entityIds),
    byIds<R["profiles"][number]>("profiles", "entity_id", entityIds),
    recent<R["movements"][number]>("movements", "entity_id", entityIds, "last_observed_at", ADMIN_LIMITS.movements),
    recent<R["patterns"][number]>("patterns", "entity_id", entityIds, "created_at", ADMIN_LIMITS.patterns),
    recent<R["takes"][number]>("takes", "entity_id", entityIds, "created_at", ADMIN_LIMITS.takes),
    recent<R["snapshots"][number]>("snapshots", "entity_id", entityIds, "created_at", ADMIN_LIMITS.snapshots),
    recent<R["sources"][number]>("sources", "status", ["collected", "reviewed", "rejected", "superseded"], "collected_at", ADMIN_LIMITS.sources),
    recent<R["events"][number]>("events", "target_type", ["entity", "source", "evidence", "movement", "theme", "pattern", "take", "snapshot"], "occurred_at", ADMIN_LIMITS.events),
  ])
  const truncated = { movements: movements.length >= ADMIN_LIMITS.movements, patterns: patterns.length >= ADMIN_LIMITS.patterns, takes: takes.length >= ADMIN_LIMITS.takes, snapshots: snapshots.length >= ADMIN_LIMITS.snapshots, sources: queueSources.length >= ADMIN_LIMITS.sources, events: events.length >= ADMIN_LIMITS.events }

  // Close lineage over the loaded analysis rows so limits never fabricate missing links.
  const missing = <T extends { id: Id }>(rows: readonly T[], ids: Iterable<Id>) => { const have = new Set(rows.map(row => row.id)); return [...new Set(ids)].filter(id => !have.has(id)) }
  const link = async <T>(table: string, columns: string, column: string, ids: Iterable<Id>) => {
    const list = [...new Set(ids)], rows: T[] = []
    for (let start = 0; start < list.length; start += 100) rows.push(...await run<T>(client.from(table).select(columns).in(column, list.slice(start, start + 100))))
    return rows
  }
  const snapshotLinks = await link<R["snapshotTakes"][number]>("snapshot_takes", "snapshot_id,take_id", "snapshot_id", snapshots.map(row => row.id))
  takes.push(...await byIds<R["takes"][number]>("takes", "id", missing(takes, snapshotLinks.map(row => row.take_id))))
  patterns.push(...await byIds<R["patterns"][number]>("patterns", "id", missing(patterns, takes.map(row => row.pattern_id))))
  patterns.push(...await byIds<R["patterns"][number]>("patterns", "id", missing(patterns, patterns.map(row => row.supersedes_id).filter((id): id is Id => Boolean(id)))))
  const [patternMovements, takeEvidence] = await Promise.all([
    link<R["patternMovements"][number]>("pattern_movements", "pattern_id,movement_id", "pattern_id", patterns.map(row => row.id)),
    link<R["takeEvidence"][number]>("take_evidence", "take_id,evidence_id", "take_id", takes.map(row => row.id)),
  ])
  movements.push(...await byIds<R["movements"][number]>("movements", "id", missing(movements, patternMovements.map(row => row.movement_id))))
  const movementEvidence = await link<R["movementEvidence"][number]>("movement_evidence", "movement_id,evidence_id", "movement_id", movements.map(row => row.id))
  const evidence = await byIds<R["evidence"][number]>("evidence", "source_item_id", queueSources.map(row => row.id))
  evidence.push(...await byIds<R["evidence"][number]>("evidence", "id", missing(evidence, [...movementEvidence.map(row => row.evidence_id), ...takeEvidence.map(row => row.evidence_id)])))
  const sources = [...queueSources, ...await byIds<R["sources"][number]>("sources", "id", missing(queueSources, evidence.map(row => row.source_item_id)))]
  const matches = await byIds<R["matches"][number]>("matches", "source_item_id", sources.map(row => row.id))
  return { rows: { entities, aliases, profiles, providers, sources, matches, evidence, movements, movementEvidence, patterns, patternMovements, takes, takeEvidence, snapshots, snapshotTakes: snapshotLinks, events }, truncated }
}
