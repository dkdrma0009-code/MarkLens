import { randomUUID } from "node:crypto"
import { z } from "zod"
import { launchRegistry } from "../registry"
import { runStructuredAI, type BrandWatchAITransport } from "../evidence/transport"
import { assessPatternEligibility, countIndependence } from "./eligibility"
import { classifyPatternCandidate } from "./duplicates"
import { buildPatternRequest, BRAND_WATCH_PATTERN_PIPELINE_VERSION, BRAND_WATCH_PATTERN_PROMPT_VERSION } from "./prompts"
import { patternAIOutputSchema, patternCandidateSchema, patternEngineInputSchema, patternPolicySchema, type PatternCandidate } from "./schemas"

// Strategy/intent/forecast wording is interpretation (a future Take), not an observed pattern.
const INTERPRETATION = /전환하려|하려\s?한다|할\s?것이다|의도|노리|버리고|목표로\s?한다|전략적|\bstrateg(?:y|ic)\b|\bpivot|\bintend|\baims? to\b|\bwill\b|\bplans? to\b|\bin order to\b/i

// Manual pure orchestration with injected transport. Never approves, publishes or writes.
export async function generatePatternCandidates(input: unknown, providers: readonly BrandWatchAITransport[], generatedAt: string, policyInput: unknown = {}) {
  const policy = patternPolicySchema.parse(policyInput)
  const { entityId, movements, existingPatterns } = patternEngineInputSchema.parse(input)
  z.iso.datetime({ offset: true }).parse(generatedAt)
  const entity = launchRegistry.find(row => row.entity.id === entityId)
  if (!entity) throw new Error("UNKNOWN_ENTITY")
  const gate = assessPatternEligibility(entityId, movements, generatedAt, policy)
  const independence = countIndependence(gate.eligible, policy)
  const base = { entityId, excluded: gate.excluded, eligibleMovementIds: gate.eligible.map(row => row.movement.id), independence }
  // Many articles about one event are still one event: no AI call below the minimum.
  if (independence.independentMovementCount < policy.minIndependentMovements) return { ...base, status: "INSUFFICIENT_INDEPENDENT_MOVEMENTS" as const, candidates: [] as PatternCandidate[], rejected: [], attempts: [] }
  const result = await runStructuredAI(buildPatternRequest(entity, gate.eligible, policy), patternAIOutputSchema, providers, policy)
  if (!result.ok) return { ...base, status: "AI_FAILURE" as const, error: result.error, candidates: [] as PatternCandidate[], rejected: [], attempts: result.attempts }
  const candidates: PatternCandidate[] = [], rejected: { index: number; issues: string[] }[] = []
  result.data.patterns.forEach((pattern, index) => {
    const issues: string[] = [], allMovementIds = new Set(movements.map(row => row.id))
    const selected = gate.eligible.filter(row => pattern.movementIds.includes(row.movement.id))
    for (const id of pattern.movementIds) if (!selected.some(row => row.movement.id === id)) issues.push(allMovementIds.has(id) ? "INELIGIBLE_MOVEMENT_ID" : "HALLUCINATED_MOVEMENT_ID")
    const reachable = new Set(selected.flatMap(row => row.movement.evidence.map(evidence => evidence.id)))
    if (pattern.evidenceIds.some(id => !reachable.has(id))) issues.push("HALLUCINATED_OR_UNREACHABLE_EVIDENCE_ID")
    if (INTERPRETATION.test(`${pattern.title} ${pattern.description}`)) issues.push("INTERPRETATION_NOT_ALLOWED")
    const counts = countIndependence(selected, policy)
    if (counts.independentMovementCount < policy.minIndependentMovements) issues.push("INSUFFICIENT_INDEPENDENT_MOVEMENTS")
    if (issues.length) { rejected.push({ index, issues: [...new Set(issues)] }); return }
    const days = selected.map(row => row.occurredOn).sort(), observed = selected.map(row => row.movement.lastObservedAt).filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(a) - Date.parse(b))
    const uncertainties = [...pattern.uncertainties]
    if (selected.some(row => row.dateBasis === "observed")) uncertainties.push("Window uses observation time for a movement without a reviewed event date.")
    if (counts.sameEventPairs.length) uncertainties.push("Some selected movements may describe the same event and were counted once.")
    if (counts.independentSourceCount < 2) uncertainties.push("All supporting movements come from a single independent source.")
    const draft = { entityId, title: pattern.title, movementIds: pattern.movementIds }
    candidates.push(patternCandidateSchema.parse({
      id: randomUUID(), entityId, entitySlug: entity.slug, title: pattern.title, description: pattern.description, movementIds: pattern.movementIds, evidenceIds: pattern.evidenceIds,
      windowStart: days[0], windowEnd: days.at(-1), lastSupportingMovementAt: observed.at(-1) ?? null,
      independentMovementCount: counts.independentMovementCount, independentSourceCount: counts.independentSourceCount, sourceItemCount: counts.sourceItemCount,
      confidence: { score: Math.min(pattern.confidence.score, 0.75), basis: pattern.confidence.basis }, uncertainties, reviewStatus: "needs_review",
      provenance: { provider: result.provider, model: result.model, promptVersion: BRAND_WATCH_PATTERN_PROMPT_VERSION, pipelineVersion: BRAND_WATCH_PATTERN_PIPELINE_VERSION, generatedAt },
      duplicate: classifyPatternCandidate(draft, existingPatterns, policy),
    }))
  })
  return { ...base, status: candidates.length ? "PATTERN_CANDIDATES" as const : "NO_PATTERN" as const, candidates, rejected, noPatternReason: result.data.noPatternReason, attempts: result.attempts }
}
