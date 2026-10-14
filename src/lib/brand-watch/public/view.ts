import { launchRegistry } from "../registry"
import { buildLineageGraph, type LineageRows } from "../lifecycle/load"
import { evaluateLineageHealth } from "../lifecycle/health"
import { isProfileIndexable, isProfilePublic, type PublicRows } from "./queries"
import type { PublicBrandCard, PublicBrandIdentity, PublicBrandState, PublicDate, PublicDatePrecision, PublicFact, PublicMovement, PublicPattern, PublicSnapshot, PublicSource, PublicTake, PublicTheme } from "./types"

const CATEGORY_LABELS: Record<string, string> = { fashion: "패션 플랫폼", beauty: "뷰티 리테일", finance: "핀테크", delivery: "배달 플랫폼", local: "로컬 커뮤니티" }
export const PUBLIC_BRAND_SLUGS = launchRegistry.map(entry => entry.slug)

export function publicBrandIdentity(slug: string): PublicBrandIdentity | null {
  const entry = launchRegistry.find(row => row.slug === slug)
  return entry ? { slug: entry.slug, name: entry.name, nameKo: entry.nameKo, category: CATEGORY_LABELS[entry.category] ?? entry.category } : null
}

type Id = string
const precisionOf = (value: string): PublicDatePrecision | null => value === "day" || value === "month" || value === "year" ? value : null
const latest = (values: (string | null | undefined)[]) => values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null

// Pure: rows (already filtered by fetchPublicBrandRows) → sanitized public state for one launch brand.
// Every object must be published and its whole lineage eligible; anything partial is hidden, never patched.
export function buildPublicBrandState(slug: string, rows: PublicRows, now: string): PublicBrandState | null {
  const brand = publicBrandIdentity(slug)
  if (!brand) return null
  const entity = rows.entities.find(row => row.slug === slug)
  const profile = entity && rows.profiles.find(row => row.entity_id === entity.id)
  if (!entity || !isProfilePublic(profile)) return { kind: "unavailable", brand }
  const entityId = entity.id

  const sources = new Map(rows.sources.map(row => [row.id, row])), providers = new Map(rows.providers.map(row => [row.id, row]))
  const primary = new Set(rows.matches.filter(row => row.entity_id === entityId && row.role === "primary" && row.review_status === "approved").map(row => row.source_item_id))
  const eligibleEvidence = new Map(rows.evidence.filter(row => row.entity_id === entityId && row.review_status === "approved" && row.status === "active" && primary.has(row.source_item_id) && providers.has(sources.get(row.source_item_id)?.provider_id ?? "")).map(row => [row.id, row]))
  const linksOf = <T, K extends keyof T>(list: readonly T[], key: K, value: Id, target: keyof T) => list.filter(row => row[key] === value).map(row => row[target] as Id)

  // Lineage completeness: a link to anything non-eligible removes the object instead of silently shrinking it.
  let movements = rows.movements.filter(row => row.entity_id === entityId && row.status === "published" && row.merged_into_id === null)
    .filter(row => { const ids = linksOf(rows.movementEvidence, "movement_id", row.id, "evidence_id"); return ids.length > 0 && ids.every(id => eligibleEvidence.has(id)) })
  let patterns = rows.patterns.filter(row => row.entity_id === entityId && row.status === "published")
  let takes = rows.takes.filter(row => row.entity_id === entityId && row.status === "published")
  let snapshot = rows.snapshots.find(row => row.id === profile!.current_snapshot_id && row.entity_id === entityId && row.status === "published") ?? null
  const consistent = () => {
    const movementIds = new Set(movements.map(row => row.id))
    patterns = patterns.filter(row => { const ids = linksOf(rows.patternMovements, "pattern_id", row.id, "movement_id"); return ids.length >= 2 && ids.every(id => movementIds.has(id)) })
    const reachable = new Map(patterns.map(row => [row.id, new Set(linksOf(rows.patternMovements, "pattern_id", row.id, "movement_id").flatMap(id => linksOf(rows.movementEvidence, "movement_id", id, "evidence_id")))]))
    takes = takes.filter(row => { const ids = linksOf(rows.takeEvidence, "take_id", row.id, "evidence_id"); return reachable.has(row.pattern_id) && ids.length > 0 && ids.every(id => eligibleEvidence.has(id) && reachable.get(row.pattern_id)!.has(id)) })
    const takeIds = new Set(takes.map(row => row.id))
    if (snapshot) { const ids = linksOf(rows.snapshotTakes, "snapshot_id", snapshot.id, "take_id"); if (!ids.length || !ids.every(id => takeIds.has(id))) snapshot = null }
  }
  consistent()

  // Structural lineage health (independence, reachability, stored coverage counts) uses the Chapter 4 checker.
  // BROKEN / REVIEW_REQUIRED objects are hidden; STALE (freshness only, since retired rows are never loaded)
  // stays visible with its as-of date. If the check itself cannot run, analysis layers are withheld.
  const stale = new Set<string>()
  try {
    const report = evaluateLineageHealth(buildLineageGraph(entityId, lineageRows(rows, movements, patterns, takes, snapshot ? [snapshot] : [], eligibleEvidence)), now)
    const keep = (kind: string, id: Id) => { const result = report.results.find(row => row.kind === kind && row.id === id); if (result?.health === "STALE") stale.add(`${kind}:${id}`); return result !== undefined && (result.health === "HEALTHY" || result.health === "STALE") }
    movements = movements.filter(row => keep("movement", row.id))
    patterns = patterns.filter(row => keep("pattern", row.id))
    takes = takes.filter(row => keep("take", row.id))
    if (snapshot && !keep("snapshot", snapshot.id)) snapshot = null
    consistent()
  } catch { patterns = []; takes = []; snapshot = null }

  // FACT layer: Movements, newest first, with their evidence and footnoted sources.
  const sourceRefs = new Map<Id, number>(), sourceList: PublicSource[] = []
  const refOf = (sourceId: Id) => {
    if (!sourceRefs.has(sourceId)) {
      const source = sources.get(sourceId)!, provider = providers.get(source.provider_id)!
      sourceRefs.set(sourceId, sourceList.length + 1)
      sourceList.push({ ref: sourceList.length + 1, provider: provider.name, providerType: provider.provider_type, title: source.title, url: source.canonical_url, publishedAt: source.published_at && precisionOf(source.date_precision) ? source.published_at : null })
    }
    return sourceRefs.get(sourceId)!
  }
  const themeById = new Map(rows.themes.map(row => [row.id, row]))
  const dated = movements.map(row => {
    const evidence = linksOf(rows.movementEvidence, "movement_id", row.id, "evidence_id").map(id => eligibleEvidence.get(id)!)
    return { row, evidence, date: movementDate(row, evidence, sources) }
  }).sort((a, b) => (b.date?.date ?? "").localeCompare(a.date?.date ?? "") || a.row.title.localeCompare(b.row.title))
  const anchorOf = new Map(dated.map((entry, index) => [entry.row.id, `move-${index + 1}`]))
  const publicMovements: PublicMovement[] = dated.map(({ row, evidence, date }) => {
    const facts: PublicFact[] = evidence.map(item => ({ id: item.id, fact: item.fact, date: item.event_date && precisionOf(item.date_precision) ? { date: item.event_date, precision: precisionOf(item.date_precision)!, basis: "event" as const } : null, sourceRef: refOf(item.source_item_id) }))
      .sort((a, b) => (a.date?.date ?? "9999").localeCompare(b.date?.date ?? "9999"))
    const refs = [...new Set(facts.map(fact => fact.sourceRef!))].sort((a, b) => a - b)
    const themes = linksOf(rows.movementThemes, "movement_id", row.id, "theme_id").map(id => themeById.get(id)).filter((theme): theme is NonNullable<typeof theme> => Boolean(theme)).map(theme => ({ slug: theme.slug, name: theme.name })).sort((a, b) => a.name.localeCompare(b.name))
    return { id: row.id, anchor: anchorOf.get(row.id)!, title: row.title, summary: row.summary, movementType: row.movement_type, date, themes, facts, sourceRefs: refs, providerCount: new Set(evidence.map(item => sources.get(item.source_item_id)!.provider_id)).size }
  })
  const movementById = new Map(publicMovements.map(row => [row.id, row]))

  // OBSERVED PATTERN layer.
  const patternOrder = [...patterns].sort((a, b) => b.window_end.localeCompare(a.window_end) || a.title.localeCompare(b.title))
  const patternAnchor = new Map(patternOrder.map((row, index) => [row.id, `pattern-${index + 1}`]))
  const publicPatterns: PublicPattern[] = patternOrder.map(row => {
    const supporting = linksOf(rows.patternMovements, "pattern_id", row.id, "movement_id").map(id => movementById.get(id)!).sort((a, b) => a.anchor.localeCompare(b.anchor, undefined, { numeric: true }))
    return { id: row.id, anchor: patternAnchor.get(row.id)!, title: row.title, description: row.description, windowStart: row.window_start, windowEnd: row.window_end, movementAnchors: supporting.map(movement => ({ anchor: movement.anchor, title: movement.title })), sourceRefs: [...new Set(supporting.flatMap(movement => movement.sourceRefs))].sort((a, b) => a - b), asOfOnly: stale.has(`pattern:${row.id}`) }
  })
  const patternById = new Map(publicPatterns.map(row => [row.id, row]))

  // MARKLENS INTERPRETATION layer.
  const takeOrder = [...takes].sort((a, b) => patternAnchor.get(a.pattern_id)!.localeCompare(patternAnchor.get(b.pattern_id)!, undefined, { numeric: true }) || a.id.localeCompare(b.id))
  const publicTakes: PublicTake[] = takeOrder.map((row, index) => {
    const pattern = patternById.get(row.pattern_id)!
    const refs = linksOf(rows.takeEvidence, "take_id", row.id, "evidence_id").map(id => refOf(eligibleEvidence.get(id)!.source_item_id))
    return { id: row.id, anchor: `take-${index + 1}`, whatWeSee: row.what_we_see, whyItMayMatter: row.why_it_may_matter, whatToWatchNext: row.what_to_watch_next, pattern: { anchor: pattern.anchor, title: pattern.title }, sourceRefs: [...new Set(refs)].sort((a, b) => a - b), asOfOnly: stale.has(`take:${row.id}`) }
  })
  const takeById = new Map(publicTakes.map(row => [row.id, row]))

  // CURRENT SYNTHESIS.
  const publicSnapshot: PublicSnapshot | null = snapshot ? {
    headline: snapshot.headline, currentDirection: snapshot.body, watchNext: snapshot.watch_next?.trim() || null, asOf: snapshot.valid_from,
    evidenceCount: snapshot.evidence_count, sourceCount: snapshot.source_count,
    takeAnchors: linksOf(rows.snapshotTakes, "snapshot_id", snapshot.id, "take_id").map(id => takeById.get(id)!).sort((a, b) => a.anchor.localeCompare(b.anchor, undefined, { numeric: true })).map(take => ({ anchor: take.anchor, patternTitle: take.pattern.title })),
    asOfOnly: stale.has(`snapshot:${snapshot.id}`),
  } : null

  const themeCounts = new Map<string, { theme: PublicTheme; count: number }>()
  for (const theme of publicMovements.flatMap(row => row.themes)) themeCounts.set(theme.slug, { theme, count: (themeCounts.get(theme.slug)?.count ?? 0) + 1 })
  const usedSources = new Set(sourceRefs.keys())
  const publishedArticles = new Map(rows.articles.map(row => [row.id, row]))
  const relatedArticleIds = new Set([...usedSources].map(id => sources.get(id)?.existing_article_id).filter((id): id is Id => Boolean(id) && publishedArticles.has(id!)))
  const relatedInsights = rows.insights.filter(row => relatedArticleIds.has(row.article_id)).map(row => ({ slug: row.slug, title: row.hook?.trim() || publishedArticles.get(row.article_id)?.title?.trim() || row.slug }))
    .sort((a, b) => a.title.localeCompare(b.title))

  return {
    kind: "available", brand, indexable: isProfileIndexable(profile) && publicSnapshot !== null,
    lastUpdate: profile!.last_meaningful_update_at ?? latest([publicSnapshot?.asOf, ...publicMovements.map(row => row.date?.date)]),
    snapshot: publicSnapshot, movements: publicMovements, patterns: publicPatterns, takes: publicTakes, sources: sourceList,
    themes: [...themeCounts.values()].sort((a, b) => b.count - a.count || a.theme.name.localeCompare(b.theme.name)).map(entry => entry.theme),
    relatedInsights,
  }
}

// Event day first (reviewed start or evidence event date), then report date, then observation; the basis is always shown.
function movementDate(row: PublicRows["movements"][number], evidence: PublicRows["evidence"], sources: Map<Id, PublicRows["sources"][number]>): PublicDate | null {
  const events = [
    ...(row.started_at ? [{ date: row.started_at.slice(0, 10), precision: "day" as PublicDatePrecision }] : []),
    ...evidence.flatMap(item => item.event_date && precisionOf(item.date_precision) ? [{ date: item.event_date, precision: precisionOf(item.date_precision)! }] : []),
  ].sort((a, b) => a.date.localeCompare(b.date))
  if (events.length) return { ...events[0], basis: "event" }
  const reported = evidence.flatMap(item => { const source = sources.get(item.source_item_id); const precision = source && precisionOf(source.date_precision); return source?.published_at && precision ? [{ date: source.published_at.slice(0, 10), precision }] : [] }).sort((a, b) => a.date.localeCompare(b.date))
  if (reported.length) return { ...reported[0], basis: "reported" }
  return row.last_observed_at ? { date: row.last_observed_at.slice(0, 10), precision: "day", basis: "observed" } : null
}

function lineageRows(rows: PublicRows, movements: PublicRows["movements"], patterns: PublicRows["patterns"], takes: PublicRows["takes"], snapshots: PublicRows["snapshots"], evidence: Map<Id, PublicRows["evidence"][number]>): LineageRows {
  const movementIds = new Set(movements.map(row => row.id)), patternIds = new Set(patterns.map(row => row.id)), takeIds = new Set(takes.map(row => row.id)), snapshotIds = new Set(snapshots.map(row => row.id))
  return {
    movements, patterns, takes, snapshots,
    movementEvidence: rows.movementEvidence.filter(row => movementIds.has(row.movement_id)),
    patternMovements: rows.patternMovements.filter(row => patternIds.has(row.pattern_id)),
    takeEvidence: rows.takeEvidence.filter(row => takeIds.has(row.take_id)),
    snapshotTakes: rows.snapshotTakes.filter(row => snapshotIds.has(row.snapshot_id)),
    evidence: [...evidence.values()], sources: rows.sources, providers: rows.providers, matches: rows.matches,
  }
}

export function buildPublicBrandCard(state: PublicBrandState): PublicBrandCard {
  if (state.kind !== "available") return { brand: state.brand, kind: state.kind, headline: null, recentMovements: [], lastUpdate: null }
  return { brand: state.brand, kind: state.kind, headline: state.snapshot?.headline ?? null, recentMovements: state.movements.slice(0, 2).map(row => ({ title: row.title, date: row.date })), lastUpdate: state.lastUpdate }
}

export function errorStates(slugs: readonly string[]): PublicBrandState[] {
  return slugs.map(slug => publicBrandIdentity(slug)).filter((brand): brand is PublicBrandIdentity => Boolean(brand)).map(brand => ({ kind: "error" as const, brand }))
}
