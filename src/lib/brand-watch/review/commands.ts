import { z } from "zod"
import { datePrecisions, matchRoles, movementTypes } from "../taxonomy"

// Human review commands. Each maps to one atomic 019 function; the client is injected
// (an authorized service-role client) and this module performs no environment lookup.
// actor must come from the server-side admin identity, never from client input.
const provenance = { actor: z.string().trim().min(1).max(200), reason: z.string().trim().min(1).max(1000) }
const text = (max: number) => z.string().trim().min(1).max(max)
const ids = z.array(z.uuid()).min(1).refine(values => new Set(values).size === values.length, "Duplicate evidence IDs")

export const reviewCommandSchema = z.discriminatedUnion("command", [
  z.strictObject({ command: z.literal("evidence.approve"), evidenceId: z.uuid(), matchRole: z.enum(matchRoles), ...provenance }),
  z.strictObject({ command: z.literal("evidence.reject"), evidenceId: z.uuid(), ...provenance }),
  z.strictObject({
    command: z.literal("evidence.supersede"), evidenceId: z.uuid(), ...provenance,
    successor: z.strictObject({ sourceItemId: z.uuid().nullable(), fact: text(300), supportText: text(300), supportLocator: text(4000).nullable(), eventDate: z.iso.date().nullable(), datePrecision: z.enum(datePrecisions), marketingRelevance: z.number().min(0).max(1), confidence: z.number().min(0).max(1) }),
  }),
  z.strictObject({ command: z.literal("movement.approve"), movementId: z.uuid(), ...provenance }),
  z.strictObject({ command: z.literal("movement.reject"), movementId: z.uuid(), ...provenance }),
  z.strictObject({
    command: z.literal("movement.supersede"), movementId: z.uuid(), ...provenance,
    successor: z.strictObject({ eventKey: text(200), title: text(300), summary: text(600), movementType: z.enum(movementTypes), scope: z.enum(["local", "national", "global"]), market: z.array(text(50)), channel: z.array(z.enum(["online", "offline", "social", "retail"])), startedAt: z.iso.datetime({ offset: true }).nullable(), lastObservedAt: z.iso.datetime({ offset: true }).nullable(), importance: z.number().int().min(1).max(3), evidenceIds: ids }),
  }),
  z.strictObject({ command: z.literal("movement.merge"), sourceMovementId: z.uuid(), targetMovementId: z.uuid(), ...provenance }).refine(value => value.sourceMovementId !== value.targetMovementId, "Self merge"),
])
export type ReviewCommand = z.infer<typeof reviewCommandSchema>

export const reviewErrorCodes = ["PROVENANCE_REQUIRED", "INVALID_MATCH_ROLE", "NOT_FOUND", "INVALID_TRANSITION", "MATCH_NOT_FOUND", "MATCH_REJECTED", "MATCH_ROLE_CONFLICT", "SUCCESSOR_EVIDENCE_REQUIRED", "SUCCESSOR_EVIDENCE_INVALID", "SELF_MERGE", "ENTITY_MISMATCH", "INVALID_MERGE_TARGET"] as const
export type ReviewErrorCode = (typeof reviewErrorCodes)[number] | "INVALID_COMMAND" | "PUBLICATION_REQUIREMENTS_UNMET" | "EVENT_KEY_CONFLICT" | "DATABASE_ERROR"

export interface ReviewRpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
}

function toRpc(command: ReviewCommand): [string, Record<string, unknown>] {
  const who = { p_actor: command.actor, p_reason: command.reason }
  switch (command.command) {
    case "evidence.approve": return ["brand_watch_approve_evidence", { p_evidence_id: command.evidenceId, p_match_role: command.matchRole, ...who }]
    case "evidence.reject": return ["brand_watch_reject_evidence", { p_evidence_id: command.evidenceId, ...who }]
    case "evidence.supersede": {
      const s = command.successor
      return ["brand_watch_supersede_evidence", { p_evidence_id: command.evidenceId, p_source_item_id: s.sourceItemId, p_fact: s.fact, p_support_text: s.supportText, p_support_locator: s.supportLocator, p_event_date: s.eventDate, p_date_precision: s.datePrecision, p_marketing_relevance: s.marketingRelevance, p_confidence: s.confidence, ...who }]
    }
    case "movement.approve": return ["brand_watch_approve_movement", { p_movement_id: command.movementId, ...who }]
    case "movement.reject": return ["brand_watch_reject_movement", { p_movement_id: command.movementId, ...who }]
    case "movement.supersede": {
      const s = command.successor
      return ["brand_watch_supersede_movement", { p_movement_id: command.movementId, p_event_key: s.eventKey, p_title: s.title, p_summary: s.summary, p_movement_type: s.movementType, p_scope: s.scope, p_market: s.market, p_channel: s.channel, p_started_at: s.startedAt, p_last_observed_at: s.lastObservedAt, p_importance: s.importance, p_evidence_ids: s.evidenceIds, ...who }]
    }
    case "movement.merge": return ["brand_watch_merge_movement", { p_source_id: command.sourceMovementId, p_target_id: command.targetMovementId, ...who }]
  }
}

// Database messages may contain row data; only typed codes leave this function.
function classify(error: { message: string; code?: string }): ReviewErrorCode {
  const code = /BW_REVIEW:([A-Z_]+)/.exec(error.message)?.[1]
  if (code && (reviewErrorCodes as readonly string[]).includes(code)) return code as ReviewErrorCode
  if (/approved primary-action evidence/.test(error.message)) return "PUBLICATION_REQUIREMENTS_UNMET"
  if (error.code === "23505" && /event_key/.test(error.message)) return "EVENT_KEY_CONFLICT"
  return "DATABASE_ERROR"
}

export async function executeReviewCommand(client: ReviewRpcClient, input: unknown) {
  const parsed = reviewCommandSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, code: "INVALID_COMMAND" as ReviewErrorCode }
  const [fn, args] = toRpc(parsed.data)
  const { data, error } = await client.rpc(fn, args)
  if (error) return { ok: false as const, code: classify(error) }
  return { ok: true as const, command: parsed.data.command, result: data as Record<string, unknown> }
}
