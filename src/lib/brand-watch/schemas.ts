import { z } from "zod"
import { entityTypes, relationTypes, movementTypes, providerTypes, reviewStatuses, publishStatuses, matchRoles, datePrecisions, auditActions } from "./taxonomy"

const id = z.uuid()
const text = z.string().trim().min(1)
const score = z.number().min(0).max(1)
const timestamp = z.iso.datetime({ offset: true })
const ids = z.array(id).min(1).refine(values => new Set(values).size === values.length, "Duplicate IDs")
export const provenanceSchema = z.strictObject({ model: text, promptVersion: text, pipelineVersion: text })
const revision = { revision: z.number().int().positive(), supersedesId: id.nullable(), status: z.enum(publishStatuses), provenance: provenanceSchema.nullable() }

// Domain commands use camelCase; these are neither database rows nor public DTOs.
export const entitySchema = z.strictObject({ id, slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: text, nameKo: text, entityType: z.enum(entityTypes), category: text, subcategory: text.nullable(), description: text.nullable(), status: z.enum(["active", "inactive"]) })
export const aliasSchema = z.strictObject({ entityId: id, alias: text, aliasType: z.enum(["official", "localized", "common", "historical"]), language: text })
export const relationSchema = z.strictObject({ fromEntityId: id, toEntityId: id, relationType: z.enum(relationTypes) }).refine(value => value.fromEntityId !== value.toEntityId, "Self relation")
export const providerSchema = z.strictObject({ id, name: text, domain: text, providerType: z.enum(providerTypes), sourceTier: z.number().int().min(1).max(3), reliabilityPolicy: text, active: z.boolean(), ingestionMethod: z.enum(["manual", "rss", "api"]) })
export const sourceSchema = z.strictObject({ id, providerId: id, canonicalUrl: z.url({ protocol: /^https?$/ }), originalUrl: z.url({ protocol: /^https?$/ }), title: text, publishedAt: timestamp.nullable(), datePrecision: z.enum(datePrecisions), contentHash: z.string().regex(/^[a-f0-9]{64}$/), existingArticleId: id.nullable() })
export const matchSchema = z.strictObject({ sourceItemId: id, entityId: id, role: z.enum(matchRoles), confidence: score, method: z.enum(["manual", "alias", "model"]), reviewStatus: z.enum(reviewStatuses) })
export const evidenceSchema = z.strictObject({ id, entityId: id, sourceItemId: id, fact: text, supportText: text.nullable(), supportLocator: text.nullable(), eventDate: z.iso.date().nullable(), datePrecision: z.enum(datePrecisions), marketingRelevance: score, confidence: score, extractionMethod: z.enum(["manual", "model"]), reviewStatus: z.enum(reviewStatuses), supersedesId: id.nullable(), provenance: provenanceSchema.nullable() }).refine(value => Boolean(value.supportText || value.supportLocator), "Source fragment required").refine(value => value.extractionMethod !== "model" || value.provenance !== null, "Model provenance required")
export const movementSchema = z.strictObject({ id, entityId: id, eventKey: text, title: text, summary: text, movementType: z.enum(movementTypes), scope: z.enum(["local", "national", "global"]), market: z.array(text), channel: z.array(z.enum(["online", "offline", "social", "retail"])), evidenceIds: ids, status: z.enum(publishStatuses) })
export const themeSchema = z.strictObject({ id, slug: text, name: text, status: z.enum(["candidate", "approved", "retired"]) })
export const patternSchema = z.strictObject({ id, entityId: id, title: text, description: text, windowStart: z.iso.date(), windowEnd: z.iso.date(), movementIds: ids.min(2), confidence: score, ...revision }).refine(value => value.windowStart <= value.windowEnd, "Invalid window")
export const takeSchema = z.strictObject({ id, entityId: id, patternId: id, whatWeSee: text, whyItMayMatter: text, whatToWatchNext: text, evidenceIds: ids, ...revision })
export const snapshotSchema = z.strictObject({ id, entityId: id, headline: text, body: text, validFrom: timestamp, validUntil: timestamp.nullable(), takeIds: ids, evidenceCount: z.number().int().nonnegative(), sourceCount: z.number().int().nonnegative(), ...revision }).refine(value => !value.validUntil || value.validFrom < value.validUntil, "Invalid validity interval")
export const auditSchema = z.strictObject({ targetType: z.enum(["entity", "source", "evidence", "movement", "theme", "pattern", "take", "snapshot"]), targetId: id, action: z.enum(auditActions), actor: text, reason: text, occurredAt: timestamp })

export function normalizeAlias(alias: string): string {
  return alias.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")
}

// Approval and a primary match are explicit preconditions, never inferred from a mention.
export function canSupportAction(match: z.infer<typeof matchSchema>): boolean {
  return match.role === "primary" && match.reviewStatus === "approved"
}

export const lineageSchema = z.strictObject({ sources: z.array(sourceSchema), matches: z.array(matchSchema), evidence: z.array(evidenceSchema), movements: z.array(movementSchema), patterns: z.array(patternSchema), takes: z.array(takeSchema), snapshots: z.array(snapshotSchema) }).superRefine((value, context) => {
  const fail = (message: string) => context.addIssue({ code: "custom", message })
  for (const rows of [value.sources, value.evidence, value.movements, value.patterns, value.takes, value.snapshots]) if (new Set(rows.map(row => row.id)).size !== rows.length) fail("Duplicate node ID")
  for (const evidence of value.evidence) if (!value.sources.some(source => source.id === evidence.sourceItemId)) fail("Evidence source missing")
  for (const movement of value.movements) for (const evidenceId of movement.evidenceIds) {
    const evidence = value.evidence.find(row => row.id === evidenceId)
    if (!evidence || evidence.entityId !== movement.entityId || evidence.reviewStatus !== "approved" || !value.matches.some(match => match.sourceItemId === evidence.sourceItemId && match.entityId === movement.entityId && canSupportAction(match))) fail("Movement requires approved primary-action evidence")
  }
  for (const pattern of value.patterns) {
    const movements = pattern.movementIds.map(id => value.movements.find(row => row.id === id))
    if (movements.some(row => !row || row.entityId !== pattern.entityId) || new Set(movements.map(row => row?.eventKey)).size < 2) fail("Pattern requires independent same-entity events")
  }
  for (const take of value.takes) {
    const pattern = value.patterns.find(row => row.id === take.patternId && row.entityId === take.entityId)
    const reachable = value.movements.filter(row => pattern?.movementIds.includes(row.id)).flatMap(row => row.evidenceIds)
    if (!pattern || take.evidenceIds.some(id => !reachable.includes(id))) fail("Take evidence not reachable through pattern")
  }
  for (const snapshot of value.snapshots) if (snapshot.takeIds.some(id => !value.takes.some(row => row.id === id && row.entityId === snapshot.entityId))) fail("Snapshot take missing")
})

export function evaluateEligibility(input: { recentMovementCount: number; distinctSourceCount: number; takeCount: number; hasSnapshot: boolean; lastMeaningfulUpdateAt: string | null }, now: Date) {
  const publicCandidate = input.recentMovementCount >= 3 && input.distinctSourceCount >= 2 && input.takeCount >= 1 && input.hasSnapshot
  const age = input.lastMeaningfulUpdateAt ? now.getTime() - new Date(input.lastMeaningfulUpdateAt).getTime() : Infinity
  return { publicCandidate, seoCandidate: publicCandidate && input.distinctSourceCount >= 3 && age >= 0 && age <= 90 * 86400000 }
}
