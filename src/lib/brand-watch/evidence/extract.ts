import { randomUUID } from "node:crypto"
import { z } from "zod"
import { launchRegistry, resolveLaunchAlias } from "../registry"
import { contentHash } from "../sources/normalize"
import { buildEvidenceRequest, BRAND_WATCH_EVIDENCE_PROMPT_VERSION, BRAND_WATCH_PIPELINE_VERSION } from "./prompts"
import { brandEvidenceExtractionSchema, sourceReferenceSchema, type EvidenceCandidate, type SourceReference } from "./schemas"
import { locateSupport, normalizeSupport } from "./support"
import { validateEvidenceSupport } from "./validate"
import { runStructuredAI, type BrandWatchAITransport } from "./transport"

export async function extractEvidenceCandidates(input: SourceReference, providers: readonly BrandWatchAITransport[], generatedAt: string, policy: { skipLikelyIrrelevant?: boolean; maxAttempts?: number; timeoutMs?: number } = {}) {
  const source = sourceReferenceSchema.parse(input)
  if (contentHash(source.document.title, source.document.text) !== source.document.contentHash) throw new Error("SOURCE_HASH_MISMATCH")
  z.iso.datetime({ offset: true }).parse(generatedAt)
  const request = buildEvidenceRequest(source)
  const empty = { evidence: [] as EvidenceCandidate[], sourceTruncated: request.sourceTruncated }
  // Default: all relevance candidates may be assessed. Explicit cost policy can skip unlikely articles.
  if (policy.skipLikelyIrrelevant && request.trustedContext.prefilter.signal === "LIKELY_IRRELEVANT") return { ...empty, status: "SKIPPED_POLICY" as const, attempts: [] }
  if (!request.trustedContext.allowedEntities.length) return { ...empty, status: "NO_REGISTRY_ENTITY" as const, attempts: [] }
  const result = await runStructuredAI(request, brandEvidenceExtractionSchema, providers, policy)
  if (!result.ok) return { ...empty, status: "AI_FAILURE" as const, error: result.error, attempts: result.attempts }
  const data = result.data, issues: string[] = []
  if (new Set(data.evidence.map(item => item.key)).size !== data.evidence.length || new Set(data.entityRoles.map(role => role.entitySlug)).size !== data.entityRoles.length) return { ...empty, status: "AI_FAILURE" as const, error: "SCHEMA_FAILURE" as const, attempts: result.attempts }
  const allowed = request.trustedContext.allowedEntities.map(entity => entity.slug)
  const roles = data.entityRoles.filter(role => {
    const valid = allowed.includes(role.entitySlug) && locateSupport(source.document, role.support, role.sourceLocator.field) !== null
    if (!valid) issues.push("INVALID_ROLE_SUPPORT")
    return valid
  }).map(role => ({ ...role, confidence: { ...role.confidence, score: Math.min(role.confidence.score, 0.75) } }))
  const unknownExternalEntities = data.unknownExternalEntities.filter(name => !resolveLaunchAlias(name) && normalizeSupport(`${source.document.title} ${source.document.text}`).includes(normalizeSupport(name)))
  if (unknownExternalEntities.length !== data.unknownExternalEntities.length) issues.push("UNSUPPORTED_EXTERNAL_ENTITY")
  const relevance = { ...data.relevance, confidence: { ...data.relevance.confidence, score: Math.min(data.relevance.confidence.score, 0.75) } }
  if (relevance.decision === "irrelevant") {
    if (!relevance.exclusionReason) issues.push("EXCLUSION_REASON_REQUIRED")
    return { ...empty, status: "IRRELEVANT_CANDIDATE" as const, relevance, roles, unknownExternalEntities, issues, attempts: result.attempts }
  }
  const provenance = { provider: result.provider, model: result.model, promptVersion: BRAND_WATCH_EVIDENCE_PROMPT_VERSION, pipelineVersion: BRAND_WATCH_PIPELINE_VERSION, generatedAt }
  const evidence = data.evidence.map(item => {
    const entity = launchRegistry.find(entry => entry.slug === item.entitySlug)!
    const validation = validateEvidenceSupport(source, item, roles.find(role => role.entitySlug === item.entitySlug)?.role, allowed)
    if (request.sourceTruncated) { validation.issues.push("TRUNCATED_SOURCE_REVIEW_REQUIRED"); validation.valid = false }
    return { id: randomUUID(), sourceItemId: source.sourceItemId, sourceHash: source.document.contentHash, entityId: entity.entity.id, item: { ...item, confidence: { ...item.confidence, score: Math.min(item.confidence.score, 0.75) } }, reviewState: "needs_review" as const, provenance, validation }
  })
  return { evidence, status: "EXTRACTED_CANDIDATES" as const, relevance, roles, unknownExternalEntities, provenance, issues, attempts: result.attempts, sourceTruncated: request.sourceTruncated }
}
