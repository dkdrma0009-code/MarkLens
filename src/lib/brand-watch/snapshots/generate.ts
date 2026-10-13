import { randomUUID } from "node:crypto"
import { z } from "zod"
import { launchRegistry } from "../registry"
import { runStructuredAI, type BrandWatchAITransport } from "../evidence/transport"
import { countIndependence, type EligibleMovement } from "../patterns/eligibility"
import { patternPolicySchema } from "../patterns/schemas"
import { validateUnsupportedClaims } from "../takes/claims"
import { assessSnapshotEligibility } from "./eligibility"
import { buildSnapshotRequest, BRAND_WATCH_SNAPSHOT_PIPELINE_VERSION, BRAND_WATCH_SNAPSHOT_PROMPT_VERSION } from "./prompts"
import { snapshotAIOutputSchema, snapshotCandidateSchema, snapshotEngineInputSchema, type ExistingSnapshot } from "./schemas"

// Advisory only; existing snapshots are never modified. A reviewed snapshot is revised by a new successor draft.
export function classifyExistingSnapshot(entityId: string, existing: readonly ExistingSnapshot[]) {
  const rows = existing.filter(row => row.entityId === entityId && (row.status === "draft" || row.status === "published"))
  if (!rows.length) return { decision: "NEW" as const, matchedSnapshotId: null, revision: 1 }
  if (rows.length === 1 && rows[0].status === "published") return { decision: "REVISION_CANDIDATE" as const, matchedSnapshotId: rows[0].id, revision: rows[0].revision + 1 }
  return { decision: "POSSIBLE_DUPLICATE" as const, matchedSnapshotId: rows[0].id, revision: 1 }
}

// Manual pure orchestration with injected transport. Never approves, publishes or writes.
export async function generateSnapshotCandidate(input: unknown, providers: readonly BrandWatchAITransport[], generatedAt: string, policyInput: unknown = {}) {
  const policy = patternPolicySchema.parse(policyInput)
  const { entityId, movements, patterns, takes, existingSnapshots } = snapshotEngineInputSchema.parse(input)
  z.iso.datetime({ offset: true }).parse(generatedAt)
  const entity = launchRegistry.find(row => row.entity.id === entityId)
  if (!entity) throw new Error("UNKNOWN_ENTITY")
  const gate = assessSnapshotEligibility(entityId, { movements, patterns, takes }, generatedAt, policy)
  const base = { entityId, excluded: gate.excluded, eligible: { movementIds: gate.movements.map(row => row.movement.id), patternIds: gate.patterns.map(row => row.pattern.id), takeIds: gate.takes.map(row => row.take.id) } }
  // A snapshot synthesizes direction: without a reviewed pattern nothing is sent to a model.
  if (!gate.patterns.length) return { ...base, status: "NO_ELIGIBLE_PATTERN" as const, candidate: null, issues: [], attempts: [] }
  const result = await runStructuredAI(buildSnapshotRequest(entity, gate.movements, gate.patterns, gate.takes), snapshotAIOutputSchema, providers, policy)
  if (!result.ok) return { ...base, status: "AI_FAILURE" as const, error: result.error, candidate: null, issues: [], attempts: result.attempts }
  const snapshot = result.data.snapshot
  if (!snapshot) return { ...base, status: "NO_SNAPSHOT" as const, candidate: null, issues: [], noSnapshotReason: result.data.noSnapshotReason, attempts: result.attempts }

  const issues: string[] = []
  const known = { patterns: new Set(patterns.map(row => row.id)), takes: new Set(takes.map(row => row.id)), movements: new Set(movements.map(row => row.id)) }
  const citedPatterns = gate.patterns.filter(row => snapshot.keyPatternIds.includes(row.pattern.id))
  for (const id of snapshot.keyPatternIds) if (!citedPatterns.some(row => row.pattern.id === id)) issues.push(known.patterns.has(id) ? "INELIGIBLE_PATTERN_ID" : "HALLUCINATED_PATTERN_ID")
  const citedTakes = gate.takes.filter(row => snapshot.keyTakeIds.includes(row.take.id))
  for (const id of snapshot.keyTakeIds) if (!citedTakes.some(row => row.take.id === id)) issues.push(known.takes.has(id) ? "INELIGIBLE_TAKE_ID" : "HALLUCINATED_TAKE_ID")
  if (citedTakes.some(row => !snapshot.keyPatternIds.includes(row.take.patternId))) issues.push("TAKE_PATTERN_NOT_CITED")
  const lineage = new Map<string, EligibleMovement>([...citedPatterns.flatMap(row => row.movements), ...gate.movements.filter(row => snapshot.keyMovementIds.includes(row.movement.id))].map(row => [row.movement.id, row]))
  for (const id of snapshot.keyMovementIds) if (!lineage.has(id)) issues.push(known.movements.has(id) ? "INELIGIBLE_MOVEMENT_ID" : "HALLUCINATED_MOVEMENT_ID")
  const entries = [...lineage.values()]
  const corpus = [...citedPatterns.flatMap(({ pattern }) => [pattern.title, pattern.description, pattern.windowStart, pattern.windowEnd]), ...citedTakes.flatMap(({ take }) => [take.whatWeSee, take.whyItMayMatter, take.whatToWatchNext]),
    ...entries.flatMap(({ movement, occurredOn }) => [movement.title, movement.summary, occurredOn, ...movement.evidence.flatMap(row => [row.fact, row.eventDate ?? ""])])]
  issues.push(...validateUnsupportedClaims([snapshot.headline, snapshot.currentDirection, snapshot.watchNext], corpus, entityId))
  if (issues.length) return { ...base, status: "REJECTED" as const, candidate: null, issues: [...new Set(issues)], attempts: result.attempts }

  // Counts, time and coverage come from lineage, never from the model.
  const counts = countIndependence(entries, policy)
  const evidence = entries.flatMap(row => row.movement.evidence)
  const takeEvidenceIds = [...new Set(citedTakes.flatMap(row => row.take.evidenceIds))]
  const observed = entries.map(row => row.movement.lastObservedAt).filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(a) - Date.parse(b))
  const days = [...entries.map(row => row.occurredOn), ...citedPatterns.flatMap(({ pattern }) => [pattern.windowStart, pattern.windowEnd])].sort()
  const uncertainties = [...snapshot.uncertainties]
  if (!observed.length) uncertainties.push("No supporting observation time; asOf uses the generation time.")
  if (entries.some(row => row.dateBasis === "observed")) uncertainties.push("Coverage uses observation time for a movement without a reviewed event date.")
  if (counts.sameEventPairs.length) uncertainties.push("Some movements may describe the same event and were counted once.")
  const candidate = snapshotCandidateSchema.parse({
    id: randomUUID(), entityId, entitySlug: entity.slug, headline: snapshot.headline, currentDirection: snapshot.currentDirection, watchNext: snapshot.watchNext,
    keyMovementIds: snapshot.keyMovementIds, keyPatternIds: snapshot.keyPatternIds, keyTakeIds: snapshot.keyTakeIds,
    lineage: { movementIds: entries.map(row => row.movement.id), evidenceIds: [...new Set(evidence.map(row => row.id))], sourceItemIds: [...new Set(evidence.map(row => row.sourceItemId))] },
    asOf: observed.at(-1) ?? generatedAt, coverageWindowStart: days[0], coverageWindowEnd: days.at(-1),
    movementCount: counts.independentMovementCount, sourceCount: counts.independentSourceCount, sourceItemCount: counts.sourceItemCount, patternCount: citedPatterns.length, takeCount: citedTakes.length,
    // 018 publication counts: distinct take_evidence rows and their distinct source documents.
    storedCoverage: { evidenceCount: takeEvidenceIds.length, sourceCount: new Set(takeEvidenceIds.map(id => evidence.find(row => row.id === id)?.sourceItemId)).size },
    publishReadiness: { blockers: [...(citedTakes.length ? [] : ["NO_REVIEWED_TAKE" as const]), "HUMAN_REVIEW_REQUIRED" as const] },
    confidence: { score: Math.min(snapshot.confidence.score, 0.75), basis: snapshot.confidence.basis }, uncertainties, reviewState: "needs_review",
    provenance: { provider: result.provider, model: result.model, promptVersion: BRAND_WATCH_SNAPSHOT_PROMPT_VERSION, pipelineVersion: BRAND_WATCH_SNAPSHOT_PIPELINE_VERSION, generatedAt },
    existing: classifyExistingSnapshot(entityId, existingSnapshots),
  })
  return { ...base, status: "SNAPSHOT_CANDIDATE" as const, candidate, issues: [], attempts: result.attempts }
}
