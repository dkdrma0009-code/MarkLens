import { createHash } from "node:crypto"
import { launchRegistry } from "../registry"
import { executeReviewCommand, type ReviewRpcClient } from "../review/commands"
import { LAUNCH_REVIEWED_AT, launchEvidence, launchMovements, launchPatterns, launchProviders, launchSnapshots, launchSources, launchTakes, launchThemes } from "./dataset"

// Applies the launch dataset through the real lifecycle: pending Evidence → evidence review → draft Movement →
// movement review → 020 draft saves → 021 publish. Every step uses the existing commands, so 018–021 guards apply.
// The client is injected (PGlite in tests; an approved service-role adapter at the Release Gate). Nothing here runs
// on import, and it never changes profile visibility.
export interface LaunchSeedClient extends ReviewRpcClient {
  insert(table: string, row: Record<string, unknown>): Promise<void>
}

const entityId = (slug: string) => launchRegistry.find(entry => entry.slug === slug)!.entity.id
export const launchCanonicalUrl = (url: string) => new URL(url).href
// Title-and-URL identity: no article body is stored, so the hash covers only what is kept.
export const launchContentHash = (title: string, url: string) => createHash("sha256").update(JSON.stringify(["bw-launch-v1", title, launchCanonicalUrl(url)])).digest("hex")

export async function seedLaunchDataset(client: LaunchSeedClient, options: { actor: string; reviewedAt?: string }) {
  const reviewedAt = options.reviewedAt ?? LAUNCH_REVIEWED_AT
  const review = async (command: Record<string, unknown>) => {
    const result = await executeReviewCommand(client, { ...command, actor: options.actor })
    if (!result.ok) throw new Error(`LAUNCH_SEED_FAILED:${String(command.command)}:${result.code}`)
    return result
  }
  const save = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await client.rpc(fn, { ...args, p_generation_model: null, p_prompt_version: null, p_pipeline_version: null, p_generated_at: reviewedAt })
    if (error) throw new Error(`LAUNCH_SEED_FAILED:${fn}`)
  }

  for (const entry of launchRegistry) await client.insert("brand_entities", { id: entry.entity.id, slug: entry.slug, name: entry.name, name_ko: entry.nameKo, entity_type: entry.entity.entityType, category: entry.category })
  for (const row of launchThemes) await client.insert("themes", { id: row.id, slug: row.slug, name: row.name, status: "approved" })
  for (const row of launchProviders) await client.insert("source_providers", { id: row.id, name: row.name, domain: row.domain, provider_type: row.providerType, source_tier: row.sourceTier, reliability_policy: "Attribution only: title, link and date are stored; no article body.", active: false, ingestion_method: "manual" })
  for (const row of launchSources) {
    const canonical = launchCanonicalUrl(row.url)
    await client.insert("source_items", { id: row.id, provider_id: row.providerId, canonical_url: canonical, original_url: canonical, title: row.title, published_at: row.publishedAt, date_precision: row.datePrecision, content_hash: launchContentHash(row.title, row.url), collected_at: reviewedAt })
    // Alias-level candidates only: a mention never becomes an action without explicit review.
    for (const match of row.matches) await client.insert("source_entity_matches", { source_item_id: row.id, entity_id: entityId(match.entity), role: "mentioned", confidence: 0.5, method: "manual", review_status: "pending" })
  }
  for (const row of launchEvidence) {
    await client.insert("brand_evidence", { id: row.id, entity_id: entityId(row.entity), source_item_id: row.sourceId, fact: row.fact, support_text: row.supportText, event_date: row.eventDate, date_precision: row.datePrecision, marketing_relevance: row.decision.action === "approve" ? 1 : 0, confidence: 0.9, extraction_method: "manual", review_status: "pending" })
    await review(row.decision.action === "approve"
      ? { command: "evidence.approve", evidenceId: row.id, matchRole: "primary", reason: row.decision.reason }
      : { command: "evidence.reject", evidenceId: row.id, reason: row.decision.reason })
  }
  for (const row of launchMovements) {
    const entity = entityId(row.entity)
    await client.insert("brand_movements", { id: row.id, entity_id: entity, event_key: row.eventKey, title: row.title, summary: row.summary, movement_type: row.movementType, scope: row.scope, market: row.market, channel: row.channel, importance: row.importance, last_observed_at: row.lastObservedAt })
    for (const evidenceId of row.evidenceIds) await client.insert("movement_evidence", { entity_id: entity, movement_id: row.id, evidence_id: evidenceId })
    for (const themeId of row.themes) await client.insert("movement_themes", { movement_id: row.id, theme_id: themeId })
    await review({ command: "movement.approve", movementId: row.id, reason: row.reason })
  }
  for (const row of launchPatterns) {
    await save("brand_watch_save_pattern_draft", { p_id: row.id, p_entity_id: entityId(row.entity), p_title: row.title, p_description: row.description, p_window_start: row.windowStart, p_window_end: row.windowEnd, p_confidence: 0.6, p_uncertainties: row.uncertainties, p_revision: 1, p_supersedes_id: null, p_movement_ids: row.movementIds })
    await review({ command: "pattern.publish", patternId: row.id, reason: row.reason })
  }
  for (const row of launchTakes) {
    await save("brand_watch_save_take_draft", { p_id: row.id, p_entity_id: entityId(row.entity), p_pattern_id: row.patternId, p_what_we_see: row.whatWeSee, p_why_it_may_matter: row.whyItMayMatter, p_what_to_watch_next: row.whatToWatchNext, p_confidence: 0.6, p_uncertainties: row.uncertainties, p_revision: 1, p_supersedes_id: null, p_evidence_ids: row.evidenceIds })
    await review({ command: "take.publish", takeId: row.id, reason: row.reason })
  }
  for (const row of launchSnapshots) {
    const takes = launchTakes.filter(take => row.takeIds.includes(take.id))
    const evidenceIds = new Set(takes.flatMap(take => take.evidenceIds))
    const sourceIds = new Set([...evidenceIds].map(id => launchEvidence.find(item => item.id === id)!.sourceId))
    await save("brand_watch_save_snapshot_draft", { p_id: row.id, p_entity_id: entityId(row.entity), p_headline: row.headline, p_body: row.body, p_watch_next: row.watchNext, p_valid_from: row.validFrom, p_evidence_count: evidenceIds.size, p_source_count: sourceIds.size, p_confidence: 0.6, p_uncertainties: row.uncertainties, p_revision: 1, p_supersedes_id: null, p_take_ids: row.takeIds })
    await review({ command: "snapshot.publish", snapshotId: row.id, reason: row.reason })
  }
  return { sources: launchSources.length, evidence: launchEvidence.length, movements: launchMovements.length, patterns: launchPatterns.length, takes: launchTakes.length, snapshots: launchSnapshots.length }
}
