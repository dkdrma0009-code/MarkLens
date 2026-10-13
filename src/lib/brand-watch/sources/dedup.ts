import type { NormalizedSourceDocument } from "./types"

export interface StoredSourceIdentity { id: string; providerId: string; canonicalUrl: string; contentHash: string }
export type SourceDisposition = "NEW" | "NO_OP" | "REVISION_CANDIDATE" | "DUPLICATE_CANDIDATE"
export function classifySourceDocument(document: NormalizedSourceDocument, existing: readonly StoredSourceIdentity[]): SourceDisposition {
  if (existing.some(row => row.canonicalUrl === document.canonicalUrl && row.contentHash === document.contentHash)) return "NO_OP"
  if (existing.some(row => row.canonicalUrl === document.canonicalUrl)) return "REVISION_CANDIDATE"
  if (existing.some(row => row.contentHash === document.contentHash)) return "DUPLICATE_CANDIDATE"
  return "NEW"
}
