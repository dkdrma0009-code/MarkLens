import { z } from "zod"
import { launchRegistry } from "../registry"
import { publishStatuses } from "../taxonomy"
import { confidenceSchema } from "../evidence/schemas"
import { patternMovementInputSchema } from "../patterns/schemas"
import { takePatternInputSchema } from "../takes/schemas"

const text = (max: number) => z.string().trim().min(1).max(max)
const uniqueIds = (min: number, max: number) => z.array(z.uuid()).min(min).max(max).refine(values => new Set(values).size === values.length, "Duplicate IDs")
const timestamp = z.iso.datetime({ offset: true })

// Reviewed 018 rows; evidenceIds are the take_evidence links of each Take.
export const snapshotTakeInputSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), patternId: z.uuid(), status: z.enum(publishStatuses), revision: z.number().int().positive(),
  whatWeSee: text(600), whyItMayMatter: text(800), whatToWatchNext: text(600), evidenceIds: uniqueIds(1, 40),
})
export const existingSnapshotSchema = z.strictObject({ id: z.uuid(), entityId: z.uuid(), status: z.enum(publishStatuses), revision: z.number().int().positive() })
export const snapshotEngineInputSchema = z.strictObject({
  entityId: z.uuid(), movements: z.array(patternMovementInputSchema).max(100), patterns: z.array(takePatternInputSchema).max(20),
  takes: z.array(snapshotTakeInputSchema).max(20), existingSnapshots: z.array(existingSnapshotSchema).max(100),
})
export type SnapshotTakeInput = z.infer<typeof snapshotTakeInputSchema>
export type ExistingSnapshot = z.infer<typeof existingSnapshotSchema>

// No dates or counts are accepted from the model; the engine derives them from lineage.
export const snapshotAIOutputSchema = z.strictObject({
  snapshot: z.strictObject({
    headline: text(120), currentDirection: text(800), watchNext: text(600),
    keyMovementIds: uniqueIds(0, 10), keyPatternIds: uniqueIds(1, 5), keyTakeIds: uniqueIds(0, 5),
    uncertainties: z.array(text(200)).max(5), confidence: confidenceSchema,
  }).nullable(),
  noSnapshotReason: text(300).nullable(),
})

export const snapshotCandidateSchema = z.strictObject({
  id: z.uuid(), entityId: z.uuid(), entitySlug: z.enum(launchRegistry.map(entry => entry.slug)),
  headline: text(120), currentDirection: text(800), watchNext: text(600),
  keyMovementIds: uniqueIds(0, 10), keyPatternIds: uniqueIds(1, 5), keyTakeIds: uniqueIds(0, 5),
  lineage: z.strictObject({ movementIds: uniqueIds(1, 100), evidenceIds: uniqueIds(1, 400), sourceItemIds: uniqueIds(1, 400) }),
  asOf: timestamp, coverageWindowStart: z.iso.date(), coverageWindowEnd: z.iso.date(),
  movementCount: z.number().int().min(1), sourceCount: z.number().int().min(1), sourceItemCount: z.number().int().min(1), patternCount: z.number().int().min(1), takeCount: z.number().int().min(0),
  storedCoverage: z.strictObject({ evidenceCount: z.number().int().min(0), sourceCount: z.number().int().min(0) }),
  publishReadiness: z.strictObject({ blockers: z.array(z.enum(["NO_REVIEWED_TAKE", "HUMAN_REVIEW_REQUIRED"])) }),
  confidence: z.strictObject({ score: z.number().min(0).max(0.75), basis: text(300) }), uncertainties: z.array(text(200)).max(10),
  reviewState: z.literal("needs_review"),
  provenance: z.strictObject({ provider: text(100), model: text(100), promptVersion: z.literal("snapshot-v1"), pipelineVersion: z.literal("snapshot-engine-v1"), generatedAt: timestamp }),
  existing: z.strictObject({ decision: z.enum(["NEW", "POSSIBLE_DUPLICATE", "REVISION_CANDIDATE"]), matchedSnapshotId: z.uuid().nullable(), revision: z.number().int().positive() }),
}).refine(value => value.coverageWindowStart <= value.coverageWindowEnd, "Invalid coverage window")
  .refine(value => launchRegistry.some(entry => entry.slug === value.entitySlug && entry.entity.id === value.entityId), "Registry entity mismatch")
  .refine(value => value.sourceCount <= value.sourceItemCount, "Independent sources exceed sources")
export type SnapshotCandidate = z.infer<typeof snapshotCandidateSchema>
