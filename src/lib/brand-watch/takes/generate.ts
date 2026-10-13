import { randomUUID } from "node:crypto"
import { z } from "zod"
import { launchRegistry } from "../registry"
import { runStructuredAI, type BrandWatchAITransport } from "../evidence/transport"
import { patternPolicySchema } from "../patterns/schemas"
import { validateTakeClaims } from "./claims"
import { assessTakeEligibility } from "./eligibility"
import { buildTakeRequest, BRAND_WATCH_TAKE_PIPELINE_VERSION, BRAND_WATCH_TAKE_PROMPT_VERSION } from "./prompts"
import { takeCandidateSchema, takeEngineInputSchema, takeAIOutputSchema, type ExistingTake, type TakeCandidate } from "./schemas"

// Advisory only; existing takes are never modified. A reviewed take is revised by a new successor draft.
export function classifyExistingTake(entityId: string, patternId: string, existing: readonly ExistingTake[]) {
  const rows = existing.filter(row => row.entityId === entityId && row.patternId === patternId && (row.status === "draft" || row.status === "published"))
  if (!rows.length) return { decision: "NEW" as const, matchedTakeId: null, revision: 1 }
  if (rows.length === 1 && rows[0].status === "published") return { decision: "REVISION_CANDIDATE" as const, matchedTakeId: rows[0].id, revision: rows[0].revision + 1 }
  return { decision: "POSSIBLE_DUPLICATE" as const, matchedTakeId: rows[0].id, revision: 1 }
}

// Manual pure orchestration with injected transport. Never approves, publishes or writes.
export async function generateTakeCandidates(input: unknown, providers: readonly BrandWatchAITransport[], generatedAt: string, policyInput: unknown = {}) {
  const policy = patternPolicySchema.parse(policyInput)
  const { entityId, patterns, movements, existingTakes } = takeEngineInputSchema.parse(input)
  z.iso.datetime({ offset: true }).parse(generatedAt)
  const entity = launchRegistry.find(row => row.entity.id === entityId)
  if (!entity) throw new Error("UNKNOWN_ENTITY")
  const gate = assessTakeEligibility(entityId, patterns, movements, generatedAt, policy)
  const base = { entityId, excluded: gate.excluded, eligiblePatternIds: gate.eligible.map(row => row.pattern.id) }
  // No reviewed pattern, no take: nothing is sent to a model.
  if (!gate.eligible.length) return { ...base, status: "NO_ELIGIBLE_PATTERN" as const, candidates: [] as TakeCandidate[], rejected: [], attempts: [] }
  const result = await runStructuredAI(buildTakeRequest(entity, gate.eligible), takeAIOutputSchema, providers, policy)
  if (!result.ok) return { ...base, status: "AI_FAILURE" as const, error: result.error, candidates: [] as TakeCandidate[], rejected: [], attempts: result.attempts }
  const knownPatternIds = new Set(patterns.map(row => row.id)), knownMovementIds = new Set(movements.map(row => row.id))
  const knownEvidenceIds = new Set(movements.flatMap(row => row.evidence.map(evidence => evidence.id)))
  const candidates: TakeCandidate[] = [], rejected: { index: number; issues: string[] }[] = []
  result.data.takes.forEach((take, index) => {
    const issues: string[] = []
    const lineage = gate.eligible.find(row => row.pattern.id === take.patternIds[0])
    if (!lineage) issues.push(knownPatternIds.has(take.patternIds[0]) ? "INELIGIBLE_PATTERN_ID" : "HALLUCINATED_PATTERN_ID")
    const patternMovements = lineage?.movements ?? []
    for (const id of take.movementIds) if (!patternMovements.some(row => row.movement.id === id)) issues.push(knownMovementIds.has(id) ? "MOVEMENT_OUTSIDE_PATTERN_LINEAGE" : "HALLUCINATED_MOVEMENT_ID")
    const cited = patternMovements.filter(row => take.movementIds.includes(row.movement.id)).flatMap(row => row.movement.evidence)
    const patternEvidence = new Set(patternMovements.flatMap(row => row.movement.evidence.map(evidence => evidence.id)))
    for (const id of take.evidenceIds) if (!cited.some(row => row.id === id)) issues.push(!knownEvidenceIds.has(id) ? "HALLUCINATED_EVIDENCE_ID" : patternEvidence.has(id) ? "EVIDENCE_OUTSIDE_CITED_MOVEMENTS" : "EVIDENCE_OUTSIDE_PATTERN_LINEAGE")
    if (lineage) {
      const corpus = [lineage.pattern.title, lineage.pattern.description, lineage.pattern.windowStart, lineage.pattern.windowEnd, ...patternMovements.flatMap(({ movement, occurredOn }) => [movement.title, movement.summary, occurredOn, ...movement.evidence.flatMap(row => [row.fact, row.eventDate ?? ""])])]
      issues.push(...validateTakeClaims(take, corpus, entityId))
    }
    if (issues.length) { rejected.push({ index, issues: [...new Set(issues)] }); return }
    candidates.push(takeCandidateSchema.parse({
      id: randomUUID(), entityId, entitySlug: entity.slug, patternIds: take.patternIds, movementIds: take.movementIds, evidenceIds: take.evidenceIds,
      sourceItemIds: [...new Set(cited.filter(row => take.evidenceIds.includes(row.id)).map(row => row.sourceItemId))],
      whatWeSee: take.whatWeSee, whyItMayMatter: take.whyItMayMatter, whatToWatchNext: take.whatToWatchNext,
      confidence: { score: Math.min(take.confidence.score, 0.75), basis: take.confidence.basis }, uncertainties: take.uncertainties, reviewState: "needs_review",
      provenance: { provider: result.provider, model: result.model, promptVersion: BRAND_WATCH_TAKE_PROMPT_VERSION, pipelineVersion: BRAND_WATCH_TAKE_PIPELINE_VERSION, generatedAt },
      existing: classifyExistingTake(entityId, take.patternIds[0], existingTakes),
    }))
  })
  return { ...base, status: candidates.length ? "TAKE_CANDIDATES" as const : "NO_TAKE" as const, candidates, rejected, noTakeReason: result.data.noTakeReason, attempts: result.attempts }
}
