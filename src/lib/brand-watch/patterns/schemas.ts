import { z } from "zod"
import { launchRegistry } from "../registry"
import { matchRoles, movementTypes, providerTypes, publishStatuses, reviewStatuses } from "../taxonomy"
import { confidenceSchema } from "../evidence/schemas"

const text = (max: number) => z.string().trim().min(1).max(max)
const uniqueIds = (min: number, max: number) => z.array(z.uuid()).min(min).max(max).refine(values => new Set(values).size === values.length, "Duplicate IDs")
const timestamp = z.iso.datetime({ offset: true })

// Reviewed lineage as loaded from 018 rows (camelCase). Pure input: no database access here.
export const patternEvidenceInputSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), sourceItemId: z.uuid(), fact: text(300), eventDate: z.iso.date().nullable(),
  reviewStatus: z.enum(reviewStatuses), status: z.enum(["active", "superseded", "withdrawn"]), marketingRelevance: z.number().min(0).max(1),
  matchRole: z.enum(matchRoles).nullable(), matchReviewStatus: z.enum(reviewStatuses).nullable(),
  source: z.strictObject({ providerId: z.uuid(), providerType: z.enum(providerTypes), canonicalUrl: z.url({ protocol: /^https?$/ }), contentHash: z.string().regex(/^[a-f0-9]{64}$/), publishedAt: timestamp.nullable() }),
})
export const patternMovementInputSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), eventKey: text(200), title: text(300), summary: text(600), movementType: z.enum(movementTypes),
  status: z.enum(publishStatuses), mergedIntoId: z.uuid().nullable(), startedAt: timestamp.nullable(), lastObservedAt: timestamp.nullable(),
  evidence: z.array(patternEvidenceInputSchema),
})
export const existingPatternSchema = z.strictObject({ id: z.uuid(), entityId: z.uuid(), title: text(300), status: z.enum(publishStatuses), revision: z.number().int().positive(), movementIds: uniqueIds(1, 50) })
export const patternEngineInputSchema = z.strictObject({ entityId: z.uuid(), movements: z.array(patternMovementInputSchema).max(100), existingPatterns: z.array(existingPatternSchema).max(100) })
export type PatternMovementInput = z.infer<typeof patternMovementInputSchema>
export type ExistingPattern = z.infer<typeof existingPatternSchema>

// Thresholds are policy, not constants; the minimum independent movement count can never drop below 2.
export const patternPolicySchema = z.strictObject({
  minIndependentMovements: z.number().int().min(2).max(10).default(2),
  recencyDays: z.number().int().min(1).max(730).default(90),
  sameEventTitleSimilarity: z.number().min(0.5).max(1).default(0.85),
  sameEventMaxDayDistance: z.number().int().min(0).max(60).default(7),
  duplicateOverlap: z.number().min(0.1).max(1).default(0.5),
  maxAttempts: z.number().int().min(1).max(2).optional(),
  timeoutMs: z.number().int().min(1).max(30000).optional(),
})
export type PatternPolicy = z.infer<typeof patternPolicySchema>

export const patternAIOutputSchema = z.strictObject({
  patterns: z.array(z.strictObject({ title: text(120), description: text(600), movementIds: uniqueIds(2, 20), evidenceIds: uniqueIds(1, 40), uncertainties: z.array(text(200)).max(5), confidence: confidenceSchema })).max(3),
  noPatternReason: text(300).nullable(),
})

export const duplicateDecisions = ["NEW", "POSSIBLE_DUPLICATE", "REVISION_CANDIDATE"] as const
export const patternCandidateSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), entitySlug: z.enum(launchRegistry.map(entry => entry.slug)), title: text(120), description: text(600),
  movementIds: uniqueIds(2, 20), evidenceIds: uniqueIds(1, 40), windowStart: z.iso.date(), windowEnd: z.iso.date(), lastSupportingMovementAt: timestamp.nullable(),
  independentMovementCount: z.number().int().min(2), independentSourceCount: z.number().int().min(1), sourceItemCount: z.number().int().min(1),
  confidence: z.strictObject({ score: z.number().min(0).max(0.75), basis: text(300) }), uncertainties: z.array(text(200)).max(10),
  reviewStatus: z.literal("needs_review"),
  provenance: z.strictObject({ provider: text(100), model: text(100), promptVersion: z.literal("pattern-v1"), pipelineVersion: z.literal("pattern-engine-v1"), generatedAt: timestamp }),
  duplicate: z.strictObject({ decision: z.enum(duplicateDecisions), matchedPatternId: z.uuid().nullable(), revision: z.number().int().positive(), matches: z.array(z.strictObject({ patternId: z.uuid(), overlap: z.number().min(0).max(1), titleSimilarity: z.number().min(0).max(1) })) }),
}).refine(value => value.windowStart <= value.windowEnd, "Invalid window")
  .refine(value => launchRegistry.some(entry => entry.slug === value.entitySlug && entry.entity.id === value.entityId), "Registry entity mismatch")
  .refine(value => value.independentSourceCount <= value.sourceItemCount, "Independent sources exceed sources")
export type PatternCandidate = z.infer<typeof patternCandidateSchema>
