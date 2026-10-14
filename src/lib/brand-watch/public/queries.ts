// Public Brand Watch row loading (server only; called from Server Components with the service-role client).
// Strict allow-list: every query names its columns and filters to published / approved / active / current
// states in the query itself. Drafts, review events, model metadata, support spans and raw source
// content are never selected. Pure transformation into the public read model lives in ./view.

export interface PublicQueryBuilder extends PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  in(column: string, values: readonly unknown[]): PublicQueryBuilder
}
export interface PublicQueryClient { from(table: string): { select(columns: string): PublicQueryBuilder } }

type Id = string
export interface PublicRows {
  entities: { id: Id; slug: string }[]
  profiles: { entity_id: Id; public_status: string; public_override: boolean | null; seo_status: string; seo_override: boolean | null; last_meaningful_update_at: string | null; current_snapshot_id: Id | null }[]
  movements: { id: Id; entity_id: Id; event_key: string; title: string; summary: string; movement_type: string; status: string; merged_into_id: Id | null; started_at: string | null; last_observed_at: string | null }[]
  movementEvidence: { movement_id: Id; evidence_id: Id }[]
  evidence: { id: Id; entity_id: Id; source_item_id: Id; fact: string; event_date: string | null; date_precision: string; review_status: string; status: string; marketing_relevance: number | string }[]
  sources: { id: Id; provider_id: Id; canonical_url: string; original_url: string; title: string; published_at: string | null; date_precision: string; content_hash: string; existing_article_id: Id | null }[]
  providers: { id: Id; name: string; provider_type: string }[]
  matches: { source_item_id: Id; entity_id: Id; role: string; review_status: string }[]
  patterns: { id: Id; entity_id: Id; title: string; description: string; window_start: string; window_end: string; status: string; revision: number }[]
  patternMovements: { pattern_id: Id; movement_id: Id }[]
  takes: { id: Id; entity_id: Id; pattern_id: Id; status: string; revision: number; what_we_see: string; why_it_may_matter: string; what_to_watch_next: string }[]
  takeEvidence: { take_id: Id; evidence_id: Id }[]
  snapshots: { id: Id; entity_id: Id; headline: string; body: string; watch_next: string | null; status: string; revision: number; valid_from: string; evidence_count: number; source_count: number }[]
  snapshotTakes: { snapshot_id: Id; take_id: Id }[]
  movementThemes: { movement_id: Id; theme_id: Id }[]
  themes: { id: Id; slug: string; name: string }[]
  insights: { slug: string; hook: string | null; article_id: Id }[]
  articles: { id: Id; title: string | null }[]
}

// Column allow-list. content_hash / canonical_url / event_key / match rows are read only for the server-side
// lineage check and are never copied into the public model.
export const PUBLIC_COLUMNS = {
  entities: "id,slug",
  profiles: "entity_id,public_status,public_override,seo_status,seo_override,last_meaningful_update_at,current_snapshot_id",
  movements: "id,entity_id,event_key,title,summary,movement_type,status,merged_into_id,started_at,last_observed_at",
  movementEvidence: "movement_id,evidence_id",
  evidence: "id,entity_id,source_item_id,fact,event_date,date_precision,review_status,status,marketing_relevance",
  sources: "id,provider_id,canonical_url,original_url,title,published_at,date_precision,content_hash,existing_article_id",
  providers: "id,name,provider_type",
  matches: "source_item_id,entity_id,role,review_status",
  patterns: "id,entity_id,title,description,window_start,window_end,status,revision",
  patternMovements: "pattern_id,movement_id",
  takes: "id,entity_id,pattern_id,status,revision,what_we_see,why_it_may_matter,what_to_watch_next",
  takeEvidence: "take_id,evidence_id",
  snapshots: "id,entity_id,headline,body,watch_next,status,revision,valid_from,evidence_count,source_count",
  snapshotTakes: "snapshot_id,take_id",
  movementThemes: "movement_id,theme_id",
  themes: "id,slug,name",
  insights: "slug,hook,article_id",
  articles: "id,title",
} as const

const PUBLISHED = ["published"] as const
const emptyRows = (): PublicRows => ({ entities: [], profiles: [], movements: [], movementEvidence: [], evidence: [], sources: [], providers: [], matches: [], patterns: [], patternMovements: [], takes: [], takeEvidence: [], snapshots: [], snapshotTakes: [], movementThemes: [], themes: [], insights: [], articles: [] })

// Effective visibility: a reviewed override wins, otherwise the profile's own status.
export const isProfilePublic = (profile: Pick<PublicRows["profiles"][number], "public_status" | "public_override"> | undefined) =>
  Boolean(profile) && (profile!.public_override ?? profile!.public_status === "published")
export const isProfileIndexable = (profile: Pick<PublicRows["profiles"][number], "seo_status" | "seo_override"> | undefined) =>
  Boolean(profile) && (profile!.seo_override ?? profile!.seo_status === "index")

export async function fetchPublicBrandRows(client: PublicQueryClient, slugs: readonly string[]): Promise<PublicRows> {
  const run = async <T>(builder: PublicQueryBuilder) => {
    const { data, error } = await builder
    if (error) throw new Error("BRAND_WATCH_PUBLIC_LOAD_FAILED")
    return (data ?? []) as T[]
  }
  // Chunked IN lookups keep PostgREST URLs bounded; extra filters are applied to every chunk.
  const select = async <T>(table: string, columns: string, column: string, values: Iterable<unknown>, filters: [string, readonly unknown[]][] = []) => {
    const list = [...new Set(values)], rows: T[] = []
    for (let start = 0; start < list.length; start += 100) {
      let builder = client.from(table).select(columns).in(column, list.slice(start, start + 100))
      for (const [filterColumn, allowed] of filters) builder = builder.in(filterColumn, allowed)
      rows.push(...await run<T>(builder))
    }
    return rows
  }
  type R = PublicRows
  const rows = emptyRows()
  if (!slugs.length) return rows

  rows.entities = await select<R["entities"][number]>("brand_entities", PUBLIC_COLUMNS.entities, "slug", slugs, [["status", ["active"]]])
  rows.profiles = await select<R["profiles"][number]>("brand_watch_profiles", PUBLIC_COLUMNS.profiles, "entity_id", rows.entities.map(row => row.id))
  const visible = rows.entities.map(row => row.id).filter(id => isProfilePublic(rows.profiles.find(profile => profile.entity_id === id)))
  if (!visible.length) return rows

  // Only the profile's current snapshot is ever considered, and only while it is published.
  const current = rows.profiles.filter(row => visible.includes(row.entity_id) && row.current_snapshot_id).map(row => row.current_snapshot_id!)
  ;[rows.movements, rows.patterns, rows.takes, rows.snapshots] = await Promise.all([
    select<R["movements"][number]>("brand_movements", PUBLIC_COLUMNS.movements, "entity_id", visible, [["status", PUBLISHED]]),
    select<R["patterns"][number]>("brand_patterns", PUBLIC_COLUMNS.patterns, "entity_id", visible, [["status", PUBLISHED]]),
    select<R["takes"][number]>("brand_takes", PUBLIC_COLUMNS.takes, "entity_id", visible, [["status", PUBLISHED]]),
    select<R["snapshots"][number]>("brand_snapshots", PUBLIC_COLUMNS.snapshots, "id", current, [["status", PUBLISHED], ["entity_id", visible]]),
  ])
  rows.movements = rows.movements.filter(row => row.merged_into_id === null)
  ;[rows.movementEvidence, rows.patternMovements, rows.takeEvidence, rows.snapshotTakes, rows.movementThemes] = await Promise.all([
    select<R["movementEvidence"][number]>("movement_evidence", PUBLIC_COLUMNS.movementEvidence, "movement_id", rows.movements.map(row => row.id)),
    select<R["patternMovements"][number]>("pattern_movements", PUBLIC_COLUMNS.patternMovements, "pattern_id", rows.patterns.map(row => row.id)),
    select<R["takeEvidence"][number]>("take_evidence", PUBLIC_COLUMNS.takeEvidence, "take_id", rows.takes.map(row => row.id)),
    select<R["snapshotTakes"][number]>("snapshot_takes", PUBLIC_COLUMNS.snapshotTakes, "snapshot_id", rows.snapshots.map(row => row.id)),
    select<R["movementThemes"][number]>("movement_themes", PUBLIC_COLUMNS.movementThemes, "movement_id", rows.movements.map(row => row.id)),
  ])
  const evidenceIds = [...rows.movementEvidence.map(row => row.evidence_id), ...rows.takeEvidence.map(row => row.evidence_id)]
  ;[rows.evidence, rows.themes] = await Promise.all([
    select<R["evidence"][number]>("brand_evidence", PUBLIC_COLUMNS.evidence, "id", evidenceIds, [["review_status", ["approved"]], ["status", ["active"]], ["entity_id", visible]]),
    select<R["themes"][number]>("themes", PUBLIC_COLUMNS.themes, "id", rows.movementThemes.map(row => row.theme_id), [["status", ["approved"]]]),
  ])
  const sourceIds = rows.evidence.map(row => row.source_item_id)
  ;[rows.sources, rows.matches] = await Promise.all([
    select<R["sources"][number]>("source_items", PUBLIC_COLUMNS.sources, "id", sourceIds, [["status", ["collected", "reviewed", "superseded"]]]),
    select<R["matches"][number]>("source_entity_matches", PUBLIC_COLUMNS.matches, "source_item_id", sourceIds, [["entity_id", visible], ["review_status", ["approved"]]]),
  ])
  rows.providers = await select<R["providers"][number]>("source_providers", PUBLIC_COLUMNS.providers, "id", rows.sources.map(row => row.provider_id))
  // Related Insights exist only through a stored source → Article link, and only for published Articles.
  const articleIds = rows.sources.map(row => row.existing_article_id).filter((id): id is Id => Boolean(id))
  rows.articles = await select<R["articles"][number]>("articles", PUBLIC_COLUMNS.articles, "id", articleIds, [["status", ["published"]]])
  rows.insights = await select<R["insights"][number]>("insights", PUBLIC_COLUMNS.insights, "article_id", rows.articles.map(row => row.id))
  return rows
}
