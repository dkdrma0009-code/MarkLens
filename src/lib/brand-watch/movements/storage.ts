import { z } from "zod"
import { movementCandidateSchema, type MovementCandidate } from "./schemas"
import type { EvidenceCandidate, SourceReference } from "../evidence/schemas"
import { preparePendingEvidence } from "../evidence/storage"

export function prepareDraftMovement(input: MovementCandidate, evidence: readonly EvidenceCandidate[], sources: readonly SourceReference[], dimensions: { scope: "local" | "national" | "global"; market: string[]; channel: ("online" | "offline" | "social" | "retail")[]; importance: number }) {
  const candidate = movementCandidateSchema.parse(input)
  const checked = z.strictObject({ scope: z.enum(["local", "national", "global"]), market: z.array(z.string().min(1)), channel: z.array(z.enum(["online", "offline", "social", "retail"])), importance: z.number().int().min(1).max(3) }).parse(dimensions)
  const actualSourceIds = new Set<string>()
  for (const id of candidate.supportingEvidenceIds) {
    const item = evidence.find(row => row.id === id && row.entityId === candidate.entityId)
    const source = sources.find(row => row.sourceItemId === item?.sourceItemId)
    if (!item || !source || item.item.entitySlug !== candidate.entitySlug || item.item.movementType !== candidate.movementType || item.item.entityRole === "mentioned" || item.item.marketingRelevance === "irrelevant" || item.item.exclusionReason) throw new Error("MOVEMENT_LINEAGE_INVALID")
    preparePendingEvidence(item, source)
    actualSourceIds.add(source.sourceItemId)
  }
  if (actualSourceIds.size !== candidate.sourceItemIds.length || candidate.sourceItemIds.some(id => !actualSourceIds.has(id))) throw new Error("MOVEMENT_SOURCE_LINEAGE_INVALID")
  return { movement: { id: candidate.id, entity_id: candidate.entityId, event_key: candidate.signature, title: candidate.title, summary: candidate.summary, movement_type: candidate.movementType, ...checked, started_at: null, last_observed_at: sources.filter(row => candidate.sourceItemIds.includes(row.sourceItemId)).map(row => row.document.collectedAt).sort().at(-1) ?? null, status: "draft" }, links: candidate.supportingEvidenceIds.map(id => ({ entity_id: candidate.entityId, movement_id: candidate.id, evidence_id: id })) }
}
