import { z } from "zod"
import { evidenceSchema } from "../schemas"
import { launchRegistry } from "../registry"
import { detectEntityCandidates } from "../sources/candidates"
import { contentHash } from "../sources/normalize"
import { locateSupport } from "./support"
import { brandEvidenceItemSchema, sourceReferenceSchema } from "./schemas"
import { validateEvidenceSupport } from "./validate"
import type { EvidenceCandidate, SourceReference } from "./schemas"

// Prepared rows only. Authorized, atomic review/storage commands are Phase 4.
export function preparePendingEvidence(candidate: EvidenceCandidate, source: SourceReference) {
  sourceReferenceSchema.parse(source)
  brandEvidenceItemSchema.parse(candidate.item)
  const entity = launchRegistry.find(row => row.slug === candidate.item.entitySlug && row.entity.id === candidate.entityId)
  const mentions = detectEntityCandidates(source.document.title, source.document.text)
  const allowed = launchRegistry.filter(row => mentions.some(mention => mention.entityId === row.entity.id)).map(row => row.slug)
  const checked = validateEvidenceSupport(source, candidate.item, candidate.item.entityRole, allowed)
  const locator = locateSupport(source.document, candidate.item.support, candidate.item.sourceLocator.field)
  if (!entity || candidate.reviewState !== "needs_review" || !checked.valid || !candidate.validation.valid || candidate.validation.issues.length || !locator || candidate.sourceItemId !== source.sourceItemId || candidate.sourceHash !== source.document.contentHash || contentHash(source.document.title, source.document.text) !== source.document.contentHash) throw new Error("INVALID_EVIDENCE_CANNOT_BE_STORED")
  const provenance = candidate.provenance
  z.iso.datetime({ offset: true }).parse(provenance.generatedAt)
  const supportLocator = JSON.stringify({ ...locator, validation: { method: candidate.validation.method, result: "support_validated_candidate" }, extraction: { provider: provenance.provider, model: provenance.model, generatedAt: provenance.generatedAt, factType: candidate.item.factType, movementTypeCandidate: candidate.item.movementType, eventNameCandidate: candidate.item.eventName, entityRoleCandidate: candidate.item.entityRole, relevanceCandidate: candidate.item.marketingRelevance, exclusionReason: candidate.item.exclusionReason, confidenceBasis: candidate.item.confidence.basis } })
  evidenceSchema.parse({ id: candidate.id, entityId: candidate.entityId, sourceItemId: source.sourceItemId, fact: candidate.item.fact, supportText: candidate.item.support, supportLocator, eventDate: candidate.item.eventDate, datePrecision: candidate.item.datePrecision, marketingRelevance: candidate.item.marketingRelevance === "relevant" ? 1 : candidate.item.marketingRelevance === "uncertain" ? 0.5 : 0, confidence: candidate.item.confidence.score, extractionMethod: "model", reviewStatus: "pending", supersedesId: null, provenance: { model: `${provenance.provider}:${provenance.model}`, promptVersion: provenance.promptVersion, pipelineVersion: provenance.pipelineVersion } })
  return {
    evidence: { id: candidate.id, entity_id: candidate.entityId, source_item_id: source.sourceItemId, fact: candidate.item.fact, support_text: candidate.item.support, support_locator: supportLocator, event_date: candidate.item.eventDate, date_precision: candidate.item.datePrecision, marketing_relevance: candidate.item.marketingRelevance === "relevant" ? 1 : candidate.item.marketingRelevance === "uncertain" ? 0.5 : 0, confidence: candidate.item.confidence.score, extraction_method: "model", review_status: "pending", status: "active", generation_model: `${provenance.provider}:${provenance.model}`, prompt_version: provenance.promptVersion, pipeline_version: provenance.pipelineVersion, created_at: provenance.generatedAt },
    match: { source_item_id: source.sourceItemId, entity_id: candidate.entityId, role: "mentioned", confidence: candidate.item.confidence.score, method: "model", review_status: "pending" },
  }
}
