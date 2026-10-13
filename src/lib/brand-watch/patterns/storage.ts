import { patternSchema } from "../schemas"
import { patternCandidateSchema, type PatternCandidate } from "./schemas"

// Prepared 018 rows only: status is always draft (= needs_review). No client, no write, no publish.
// Counts, uncertainties and lastSupportingMovementAt have no 018 column; they are recomputed from lineage.
export function preparePatternDraft(input: PatternCandidate) {
  const candidate = patternCandidateSchema.parse(input)
  if (candidate.duplicate.decision === "POSSIBLE_DUPLICATE") throw new Error("PATTERN_DUPLICATE_REVIEW_REQUIRED")
  const supersedesId = candidate.duplicate.decision === "REVISION_CANDIDATE" ? candidate.duplicate.matchedPatternId : null
  const model = `${candidate.provenance.provider}:${candidate.provenance.model}`
  patternSchema.parse({ id: candidate.id, entityId: candidate.entityId, title: candidate.title, description: candidate.description, windowStart: candidate.windowStart, windowEnd: candidate.windowEnd, movementIds: candidate.movementIds, confidence: candidate.confidence.score, revision: candidate.duplicate.revision, supersedesId, status: "draft", provenance: { model, promptVersion: candidate.provenance.promptVersion, pipelineVersion: candidate.provenance.pipelineVersion } })
  return {
    pattern: { id: candidate.id, entity_id: candidate.entityId, title: candidate.title, description: candidate.description, window_start: candidate.windowStart, window_end: candidate.windowEnd, confidence: candidate.confidence.score, revision: candidate.duplicate.revision, supersedes_id: supersedesId, status: "draft", generation_model: model, prompt_version: candidate.provenance.promptVersion, pipeline_version: candidate.provenance.pipelineVersion, created_at: candidate.provenance.generatedAt },
    links: candidate.movementIds.map(movementId => ({ entity_id: candidate.entityId, pattern_id: candidate.id, movement_id: movementId })),
  }
}
