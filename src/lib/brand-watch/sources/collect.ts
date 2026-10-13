import { newsroomAdapter } from "./adapters/newsroom"
import { rssAdapter } from "./adapters/rss"
import { normalizeSourceDocument } from "./normalize"
import type { CollectionOptions, NormalizedSourceDocument, SourceProvider } from "./types"

// Manual orchestration only; no cron, DB client or AI invocation.
export async function collectSourceDocuments(provider: SourceProvider, collectedAt: string, options: CollectionOptions = {}) {
  const adapter = provider.adapter === "rss" ? rssAdapter : newsroomAdapter
  const result = await adapter.collect(provider, options), documents: NormalizedSourceDocument[] = []
  for (const document of result.documents) {
    try { documents.push(normalizeSourceDocument(provider, document, collectedAt)) }
    catch { result.issues.push({ url: document.originalUrl, code: "NORMALIZATION_FAILED" }) }
  }
  return { documents, issues: result.issues }
}
