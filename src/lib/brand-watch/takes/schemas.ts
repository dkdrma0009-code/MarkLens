import { z } from "zod"
import { launchRegistry } from "../registry"
import { publishStatuses } from "../taxonomy"
import { confidenceSchema } from "../evidence/schemas"
import { patternMovementInputSchema } from "../patterns/schemas"

const text = (max: number) => z.string().trim().min(1).max(max)
const uniqueIds = (min: number, max: number) => z.array(z.uuid()).min(min).max(max).refine(values => new Set(values).size === values.length, "Duplicate IDs")
const timestamp = z.iso.datetime({ offset: true })

// Reviewed lineage loaded from 018 rows. 018 brand_takes has one pattern_id, so a Take cites exactly one Pattern.
export const takePatternInputSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), title: text(300), description: text(1000), windowStart: z.iso.date(), windowEnd: z.iso.date(),
  status: z.enum(publishStatuses), revision: z.number().int().positive(), movementIds: uniqueIds(2, 50),
})
export const existingTakeSchema = z.strictObject({ id: z.uuid(), entityId: z.uuid(), patternId: z.uuid(), status: z.enum(publishStatuses), revision: z.number().int().positive() })
export const takeEngineInputSchema = z.strictObject({
  entityId: z.uuid(), patterns: z.array(takePatternInputSchema).max(20), movements: z.array(patternMovementInputSchema).max(100), existingTakes: z.array(existingTakeSchema).max(100),
})
export type TakePatternInput = z.infer<typeof takePatternInputSchema>
export type ExistingTake = z.infer<typeof existingTakeSchema>

export const takeAIOutputSchema = z.strictObject({
  takes: z.array(z.strictObject({
    patternIds: uniqueIds(1, 1), movementIds: uniqueIds(1, 20), evidenceIds: uniqueIds(1, 40),
    whatWeSee: text(600), whyItMayMatter: text(800), whatToWatchNext: text(600),
    uncertainties: z.array(text(200)).max(5), confidence: confidenceSchema,
  })).max(3),
  noTakeReason: text(300).nullable(),
})

export const takeCandidateSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), entitySlug: z.enum(launchRegistry.map(entry => entry.slug)),
  patternIds: uniqueIds(1, 1), movementIds: uniqueIds(1, 20), evidenceIds: uniqueIds(1, 40), sourceItemIds: uniqueIds(1, 40),
  whatWeSee: text(600), whyItMayMatter: text(800), whatToWatchNext: text(600),
  confidence: z.strictObject({ score: z.number().min(0).max(0.75), basis: text(300) }), uncertainties: z.array(text(200)).max(10),
  reviewState: z.literal("needs_review"),
  provenance: z.strictObject({ provider: text(100), model: text(100), promptVersion: z.literal("take-v1"), pipelineVersion: z.literal("take-engine-v1"), generatedAt: timestamp }),
  existing: z.strictObject({ decision: z.enum(["NEW", "POSSIBLE_DUPLICATE", "REVISION_CANDIDATE"]), matchedTakeId: z.uuid().nullable(), revision: z.number().int().positive() }),
}).refine(value => launchRegistry.some(entry => entry.slug === value.entitySlug && entry.entity.id === value.entityId), "Registry entity mismatch")
export type TakeCandidate = z.infer<typeof takeCandidateSchema>
