import { randomUUID } from "node:crypto"
import { sourceSchema, providerSchema } from "../schemas"
import { classifySourceDocument, type StoredSourceIdentity } from "./dedup"
import { assertProviderUrl } from "./canonicalize"
import { contentHash } from "./normalize"
import { normalizedSourceSchema, sourceProviderSchema, type NormalizedSourceDocument, type SourceProvider } from "./types"

// Exact 018 storage shape; adapters never emit DB rows.
export interface SourceItemInsert {
  id: string; provider_id: string; canonical_url: string; original_url: string; title: string
  published_at: string | null; date_precision: "day" | "month" | "year" | "unknown"; author: string | null
  raw_text: string | null; raw_html: string | null; rights_basis: string | null; retention_until: string | null
  content_hash: string; image_url: string | null; image_provenance: string | null
  collected_at: string; existing_article_id: string | null; status: "collected"
}
export interface SourceRepository {
  related(canonicalUrl: string, contentHash: string): Promise<StoredSourceIdentity[]>
  // Atomic unique insert. Concurrent exact retries return the existing row, never overwrite.
  insertIfAbsent(row: SourceItemInsert): Promise<{ identity: StoredSourceIdentity; inserted: boolean }>
}
export function providerSeed(provider: SourceProvider) {
  sourceProviderSchema.parse(provider)
  return providerSchema.parse({ id: provider.id, name: provider.name, domain: provider.domain, providerType: provider.providerType, sourceTier: provider.sourceTier, reliabilityPolicy: "First-party attribution; tier is not a truth probability or image/text reuse permission.", active: false, ingestionMethod: provider.adapter === "rss" ? "rss" : "manual" })
}
export async function persistSourceDocument(provider: SourceProvider, input: NormalizedSourceDocument, repository: SourceRepository, options: { existingArticleId?: string; retention?: { rightsBasis: string; until: string; includeHtml?: boolean } } = {}) {
  sourceProviderSchema.parse(provider)
  const document = normalizedSourceSchema.parse(input)
  if (document.providerId !== provider.id || document.providerKey !== provider.key) throw new Error("Provider mismatch")
  assertProviderUrl(document.originalUrl, provider); assertProviderUrl(document.canonicalUrl, provider)
  if (contentHash(document.title, document.text) !== document.contentHash) throw new Error("Content hash mismatch")
  const related = await repository.related(document.canonicalUrl, document.contentHash)
  const disposition = classifySourceDocument(document, related)
  const exact = related.find(row => row.canonicalUrl === document.canonicalUrl && row.contentHash === document.contentHash)
  if (exact) {
    if (exact.providerId !== provider.id) throw new Error("Stored provider mismatch")
    return { disposition, identity: exact, inserted: false }
  }
  const retention = options.retention
  if (retention && (!retention.rightsBasis.trim() || !Number.isFinite(Date.parse(retention.until)) || Date.parse(retention.until) <= Date.parse(document.collectedAt))) throw new Error("Invalid retention policy")
  const id = randomUUID()
  sourceSchema.parse({ id, providerId: provider.id, canonicalUrl: document.canonicalUrl, originalUrl: document.originalUrl, title: document.title, publishedAt: document.publishedAt, datePrecision: document.datePrecision, contentHash: document.contentHash, existingArticleId: options.existingArticleId ?? null })
  const result = await repository.insertIfAbsent({ id, provider_id: document.providerId, canonical_url: document.canonicalUrl, original_url: document.originalUrl, title: document.title, published_at: document.publishedAt, date_precision: document.datePrecision, author: document.author, raw_text: retention ? document.text : null, raw_html: retention?.includeHtml ? document.html : null, rights_basis: retention?.rightsBasis ?? null, retention_until: retention?.until ?? null, content_hash: document.contentHash, image_url: document.imageUrl, image_provenance: document.imageSource, collected_at: document.collectedAt, existing_article_id: options.existingArticleId ?? null, status: "collected" })
  if (result.identity.providerId !== provider.id) throw new Error("Stored provider mismatch")
  return { disposition: result.inserted ? disposition : "NO_OP" as const, ...result }
}
