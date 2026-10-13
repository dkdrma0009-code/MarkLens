import { z } from "zod"
import { movementTypes } from "../taxonomy"
import { launchRegistry } from "../registry"

const ids = z.array(z.uuid()).min(1).refine(values => new Set(values).size === values.length, "Duplicate lineage IDs")
export const movementCandidateSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), entitySlug: z.enum(launchRegistry.map(entry => entry.slug)), title: z.string().min(1).max(300), summary: z.string().min(1).max(600),
  movementType: z.enum(movementTypes), eventName: z.string().min(1).max(100).nullable(), eventDate: z.iso.date().nullable(),
  scope: z.enum(["local", "national", "global"]).nullable(), market: z.array(z.string()), channel: z.array(z.enum(["online", "offline", "social", "retail"])),
  supportingEvidenceIds: ids, sourceItemIds: ids, signature: z.string().regex(/^[a-f0-9]{64}$/),
  reviewState: z.literal("needs_review"), ruleVersion: z.literal("movement-assembly-v1"),
  confidence: z.strictObject({ score: z.number().min(0).max(0.75), basis: z.literal("unreviewed_support_validated_evidence") }),
}).refine(candidate => launchRegistry.some(entry => entry.slug === candidate.entitySlug && entry.entity.id === candidate.entityId), "Registry entity mismatch")
export type MovementCandidate = z.infer<typeof movementCandidateSchema>
export const movementClusterAssessmentSchema = z.strictObject({
  candidateId: z.uuid(), existingId: z.uuid(), decision: z.enum(["SAME_EVENT_HIGH", "POSSIBLY_SAME", "DIFFERENT_EVENT"]),
  mergeReviewRequired: z.boolean(), signals: z.strictObject({ sameEntity: z.boolean(), sameType: z.boolean(), sameNamedEvent: z.boolean(), conflictingNamedEvent: z.boolean(), dayDistance: z.number().nonnegative().nullable(), titleSimilarity: z.number().min(0).max(1) }),
})
