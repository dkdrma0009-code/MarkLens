import { snapshotSchema } from "../schemas"
import { snapshotCandidateSchema, type SnapshotCandidate } from "./schemas"

export const SNAPSHOT_WATCH_NEXT_SEPARATOR = "\n\nWatch next: "

// Prepared 018 rows only: status draft, no reviewer, no client, no write, no publish.
// 018 has headline/body only: body = currentDirection + separator + watchNext. Key movement/pattern IDs,
// coverage window, independent counts, confidence and uncertainties have no columns and stay on the candidate.
export function prepareSnapshotDraft(input: SnapshotCandidate) {
  const candidate = snapshotCandidateSchema.parse(input)
  if (candidate.existing.decision === "POSSIBLE_DUPLICATE") throw new Error("SNAPSHOT_DUPLICATE_REVIEW_REQUIRED")
  const supersedesId = candidate.existing.decision === "REVISION_CANDIDATE" ? candidate.existing.matchedSnapshotId : null
  const model = `${candidate.provenance.provider}:${candidate.provenance.model}`, body = `${candidate.currentDirection}${SNAPSHOT_WATCH_NEXT_SEPARATOR}${candidate.watchNext}`
  if (candidate.keyTakeIds.length) snapshotSchema.parse({ id: candidate.id, entityId: candidate.entityId, headline: candidate.headline, body, validFrom: candidate.asOf, validUntil: null, takeIds: candidate.keyTakeIds, evidenceCount: candidate.storedCoverage.evidenceCount, sourceCount: candidate.storedCoverage.sourceCount, revision: candidate.existing.revision, supersedesId, status: "draft", provenance: { model, promptVersion: candidate.provenance.promptVersion, pipelineVersion: candidate.provenance.pipelineVersion } })
  return {
    snapshot: { id: candidate.id, entity_id: candidate.entityId, headline: candidate.headline, body, valid_from: candidate.asOf, valid_until: null, evidence_count: candidate.storedCoverage.evidenceCount, source_count: candidate.storedCoverage.sourceCount, reviewed_by: null, reviewed_at: null, revision: candidate.existing.revision, supersedes_id: supersedesId, status: "draft", generation_model: model, prompt_version: candidate.provenance.promptVersion, pipeline_version: candidate.provenance.pipelineVersion, created_at: candidate.provenance.generatedAt },
    links: candidate.keyTakeIds.map(takeId => ({ entity_id: candidate.entityId, snapshot_id: candidate.id, take_id: takeId })),
  }
}
