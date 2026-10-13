import { textSimilarity } from "../movements/independence"
import type { ExistingPattern, PatternPolicy } from "./schemas"

// Advisory only: existing rows are never modified. A revision is a new successor draft.
export function classifyPatternCandidate(candidate: { entityId: string; title: string; movementIds: readonly string[] }, existing: readonly ExistingPattern[], policy: PatternPolicy) {
  const own = new Set(candidate.movementIds)
  const matches = existing.filter(row => row.entityId === candidate.entityId && (row.status === "draft" || row.status === "published")).map(row => {
    const shared = row.movementIds.filter(id => own.has(id)).length
    return { row, overlap: shared / new Set([...row.movementIds, ...own]).size, titleSimilarity: textSimilarity(candidate.title, row.title), covers: shared === row.movementIds.length }
  }).filter(match => match.overlap >= policy.duplicateOverlap || match.titleSimilarity >= policy.sameEventTitleSimilarity)
  const summary = matches.map(match => ({ patternId: match.row.id, overlap: match.overlap, titleSimilarity: match.titleSimilarity }))
  if (!matches.length) return { decision: "NEW" as const, matchedPatternId: null, revision: 1, matches: summary }
  // Only an unambiguous strict extension of one published pattern can become its successor.
  const revisable = matches.filter(match => match.row.status === "published" && match.covers && match.overlap < 1)
  if (matches.length === 1 && revisable.length === 1) return { decision: "REVISION_CANDIDATE" as const, matchedPatternId: revisable[0].row.id, revision: revisable[0].row.revision + 1, matches: summary }
  const strongest = [...matches].sort((a, b) => b.overlap - a.overlap || b.titleSimilarity - a.titleSimilarity)[0]
  return { decision: "POSSIBLE_DUPLICATE" as const, matchedPatternId: strongest.row.id, revision: 1, matches: summary }
}
