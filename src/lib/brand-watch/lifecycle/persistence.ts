import type { ReviewRpcClient } from "../review/commands"
import { preparePatternDraft } from "../patterns/storage"
import { prepareTakeDraft } from "../takes/storage"
import { prepareSnapshotDraft } from "../snapshots/storage"
import type { PatternCandidate } from "../patterns/schemas"
import type { TakeCandidate } from "../takes/schemas"
import type { SnapshotCandidate } from "../snapshots/schemas"

// Atomic draft saves through the 020 functions (row + links + revision relation in one transaction).
// The client is an injected service-role client. Saves never review, publish or call a model.
export const saveErrorCodes = ["NOT_FOUND", "ID_CONFLICT", "LINEAGE_REQUIRED", "INELIGIBLE_LINEAGE", "INSUFFICIENT_INDEPENDENT_MOVEMENTS", "DUPLICATE", "INVALID_PREDECESSOR", "REVISION_REQUIRED", "AMBIGUOUS_PREDECESSOR", "COVERAGE_COUNT_MISMATCH"] as const
export type SaveErrorCode = (typeof saveErrorCodes)[number] | "INVALID_CANDIDATE" | "SUCCESSOR_EXISTS" | "DATABASE_ERROR"

// Database messages may contain row data; only typed codes leave this module.
function classify(error: { message: string; code?: string }): SaveErrorCode {
  const code = /BW_SAVE:([A-Z_]+)/.exec(error.message)?.[1]
  if (code && (saveErrorCodes as readonly string[]).includes(code)) return code as SaveErrorCode
  if (error.code === "23505" && /successor_idx/.test(error.message)) return "SUCCESSOR_EXISTS"
  if (/Invalid predecessor revision|First revision must be 1/.test(error.message)) return "INVALID_PREDECESSOR"
  return "DATABASE_ERROR"
}
async function save(client: ReviewRpcClient, fn: string, prepare: () => Record<string, unknown>) {
  let args: Record<string, unknown>
  try { args = prepare() } catch (error) { return { ok: false as const, code: (error instanceof Error && /DUPLICATE_REVIEW_REQUIRED/.test(error.message) ? "DUPLICATE" : "INVALID_CANDIDATE") as SaveErrorCode } }
  const { data, error } = await client.rpc(fn, args)
  if (error) return { ok: false as const, code: classify(error) }
  return { ok: true as const, result: data as Record<string, unknown> }
}

export function savePatternDraft(client: ReviewRpcClient, candidate: PatternCandidate) {
  return save(client, "brand_watch_save_pattern_draft", () => {
    const { pattern: p, links } = preparePatternDraft(candidate)
    return { p_id: p.id, p_entity_id: p.entity_id, p_title: p.title, p_description: p.description, p_window_start: p.window_start, p_window_end: p.window_end, p_confidence: p.confidence, p_uncertainties: p.uncertainties, p_revision: p.revision, p_supersedes_id: p.supersedes_id, p_movement_ids: links.map(row => row.movement_id), p_generation_model: p.generation_model, p_prompt_version: p.prompt_version, p_pipeline_version: p.pipeline_version, p_generated_at: p.created_at }
  })
}

export function saveTakeDraft(client: ReviewRpcClient, candidate: TakeCandidate) {
  return save(client, "brand_watch_save_take_draft", () => {
    const { take: t, links } = prepareTakeDraft(candidate)
    return { p_id: t.id, p_entity_id: t.entity_id, p_pattern_id: t.pattern_id, p_what_we_see: t.what_we_see, p_why_it_may_matter: t.why_it_may_matter, p_what_to_watch_next: t.what_to_watch_next, p_confidence: t.confidence, p_uncertainties: t.uncertainties, p_revision: t.revision, p_supersedes_id: t.supersedes_id, p_evidence_ids: links.map(row => row.evidence_id), p_generation_model: t.generation_model, p_prompt_version: t.prompt_version, p_pipeline_version: t.pipeline_version, p_generated_at: t.created_at }
  })
}

export function saveSnapshotDraft(client: ReviewRpcClient, candidate: SnapshotCandidate) {
  return save(client, "brand_watch_save_snapshot_draft", () => {
    const { snapshot: s, links } = prepareSnapshotDraft(candidate)
    return { p_id: s.id, p_entity_id: s.entity_id, p_headline: s.headline, p_body: s.body, p_watch_next: s.watch_next, p_valid_from: s.valid_from, p_evidence_count: s.evidence_count, p_source_count: s.source_count, p_confidence: s.confidence, p_uncertainties: s.uncertainties, p_revision: s.revision, p_supersedes_id: s.supersedes_id, p_take_ids: links.map(row => row.take_id), p_generation_model: s.generation_model, p_prompt_version: s.prompt_version, p_pipeline_version: s.pipeline_version, p_generated_at: s.created_at }
  })
}
