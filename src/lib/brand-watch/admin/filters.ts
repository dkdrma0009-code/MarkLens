import type { AdminView, SourceView } from "./view"

// Pure, client-safe queue/list filtering over the Admin read model.
export interface QueueFilters { brand: string; review: string; type: string; relevance: string; query: string }

export function filterQueue(sources: readonly SourceView[], view: AdminView, filters: QueueFilters) {
  const query = filters.query.trim().toLowerCase()
  const names = new Map(view.entities.flatMap(entity => [[entity.id, `${entity.name} ${entity.nameKo} ${entity.slug}`] as const]))
  return sources.filter(source => (filters.brand === "all" || source.entityIds.includes(filters.brand))
    && (filters.review === "all" || source.reviewState === filters.review)
    && (filters.type === "all" || source.providerType === filters.type)
    && (filters.relevance === "all" || source.relevance === filters.relevance)
    && (!query || [source.title, source.providerName, ...source.entityIds.map(id => names.get(id) ?? ""), ...view.evidence.filter(e => e.sourceItemId === source.id).map(e => e.fact)].some(text => text.toLowerCase().includes(query))))
}

export function byBrand<T extends { entityId: string }>(rows: readonly T[], brand: string) {
  return brand === "all" ? [...rows] : rows.filter(row => row.entityId === brand)
}
