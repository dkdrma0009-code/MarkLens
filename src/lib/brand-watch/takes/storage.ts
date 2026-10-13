import { takeSchema } from "../schemas"
import { takeCandidateSchema, type TakeCandidate } from "./schemas"

// Prepared 018 rows only: status is always draft (= needs_review). No client, no write, no publish.
// 018 brand_takes has no confidence/uncertainty columns; they stay on the reviewed candidate.
export function prepareTakeDraft(input: TakeCandidate) {
  const candidate = takeCandidateSchema.parse(input)
  if (candidate.existing.decision === "POSSIBLE_DUPLICATE") throw new Error("TAKE_DUPLICATE_REVIEW_REQUIRED")
  const supersedesId = candidate.existing.decision === "REVISION_CANDIDATE" ? candidate.existing.matchedTakeId : null
  const model = `${candidate.provenance.provider}:${candidate.provenance.model}`, patternId = candidate.patternIds[0]
  takeSchema.parse({ id: candidate.id, entityId: candidate.entityId, patternId, whatWeSee: candidate.whatWeSee, whyItMayMatter: candidate.whyItMayMatter, whatToWatchNext: candidate.whatToWatchNext, evidenceIds: candidate.evidenceIds, revision: candidate.existing.revision, supersedesId, status: "draft", provenance: { model, promptVersion: candidate.provenance.promptVersion, pipelineVersion: candidate.provenance.pipelineVersion } })
  return {
    take: { id: candidate.id, entity_id: candidate.entityId, pattern_id: patternId, what_we_see: candidate.whatWeSee, why_it_may_matter: candidate.whyItMayMatter, what_to_watch_next: candidate.whatToWatchNext, revision: candidate.existing.revision, supersedes_id: supersedesId, status: "draft", generation_model: model, prompt_version: candidate.provenance.promptVersion, pipeline_version: candidate.provenance.pipelineVersion, created_at: candidate.provenance.generatedAt },
    links: candidate.evidenceIds.map(evidenceId => ({ entity_id: candidate.entityId, take_id: candidate.id, evidence_id: evidenceId })),
  }
}
