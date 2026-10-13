import { z } from "zod"
import { launchRegistry } from "../registry"
import { matchRoles, movementTypes, datePrecisions, providerTypes } from "../taxonomy"
import { normalizedSourceSchema } from "../sources/types"

const entitySlug = z.enum(launchRegistry.map(entry => entry.slug))
const text = (max: number) => z.string().trim().min(1).max(max)
export const confidenceSchema = z.strictObject({ score: z.number().min(0).max(1), basis: text(300) })
export const sourceReferenceSchema = z.strictObject({ sourceItemId: z.uuid(), document: normalizedSourceSchema, providerType: z.enum(providerTypes), declaredOriginUrl: z.url({ protocol: /^https?$/ }).nullable() })
export type SourceReference = z.infer<typeof sourceReferenceSchema>
export const entityRoleAssessmentSchema = z.strictObject({ entitySlug, role: z.enum(matchRoles), support: text(300), sourceLocator: z.strictObject({ field: z.enum(["title", "text"]) }), confidence: confidenceSchema })
export const marketingRelevanceAssessmentSchema = z.strictObject({ decision: z.enum(["relevant", "uncertain", "irrelevant"]), rationale: text(500), relevantDimensions: z.array(z.enum([...movementTypes, "cx", "commerce", "offline", "global"])).max(11), exclusionReason: text(300).nullable(), confidence: confidenceSchema })
export const brandEvidenceItemSchema = z.strictObject({
  key: z.string().regex(/^e[1-9][0-9]?$/), entitySlug, fact: text(300),
  factType: z.enum(["announcement", "launch", "participation", "partnership", "promotion", "platform_update", "brand_activity"]),
  movementType: z.enum(movementTypes), eventName: text(100).nullable(), eventDate: z.iso.date().nullable(), datePrecision: z.enum(datePrecisions),
  support: text(300), sourceLocator: z.strictObject({ field: z.enum(["title", "text"]) }),
  marketingRelevance: z.enum(["relevant", "uncertain", "irrelevant"]), entityRole: z.enum(matchRoles), confidence: confidenceSchema, exclusionReason: text(300).nullable(),
})
export const brandEvidenceExtractionSchema = z.strictObject({
  entityRoles: z.array(entityRoleAssessmentSchema).max(5),
  relevance: marketingRelevanceAssessmentSchema,
  evidence: z.array(brandEvidenceItemSchema).max(10),
  unknownExternalEntities: z.array(text(100)).max(10),
})
export type EvidenceItem = z.infer<typeof brandEvidenceItemSchema>
export interface GenerationProvenance {
  provider: string; model: string; promptVersion: string; pipelineVersion: string; generatedAt: string
}
export interface SupportLocator { field: "title" | "text"; start: number; end: number; normalizationVersion: "support-v1"; sourceHash: string }
export interface EvidenceCandidate {
  id: string; sourceItemId: string; sourceHash: string; entityId: string
  item: EvidenceItem; reviewState: "needs_review"; provenance: GenerationProvenance
  validation: { valid: boolean; issues: string[]; locator: SupportLocator | null; method: "normalized_substring" }
}
