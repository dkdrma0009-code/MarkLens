import { extractEvidenceCandidates } from "./evidence/extract"
import type { SourceReference } from "./evidence/schemas"
import type { BrandWatchAITransport } from "./evidence/transport"
import { buildMovementCandidates } from "./movements/assemble"

// Single-source manual pipeline. Caller explicitly injects transport; no automatic live provider.
export async function analyzeBrandWatchSource(source: SourceReference, providers: readonly BrandWatchAITransport[], generatedAt: string, policy: { skipLikelyIrrelevant?: boolean; maxAttempts?: number; timeoutMs?: number } = {}) {
  const extraction = await extractEvidenceCandidates(source, providers, generatedAt, policy)
  return { source, extraction, movements: buildMovementCandidates(extraction.evidence, [source]) }
}
