import { createHash } from "node:crypto"
import { canonicalizeSourceUrl, assertProviderUrl } from "./canonicalize"
import { normalizedSourceSchema, sourceProviderSchema, type CollectedSourceDocument, type SourceProvider } from "./types"

export function normalizeMeaningfulText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim()
}
export function contentHash(title: string, text: string): string {
  // Versioned, length-unambiguous input; no HTML, metadata or collection clock.
  return createHash("sha256").update(JSON.stringify(["bw-source-v1", normalizeMeaningfulText(title), normalizeMeaningfulText(text)])).digest("hex")
}
export function normalizePublishedDate(input: string | null): { publishedAt: string | null; datePrecision: "day" | "unknown" } {
  if (!input) return { publishedAt: null, datePrecision: "unknown" }
  const day = input.trim().match(/^(\d{4})[.\/-](\d{2})[.\/-](\d{2})$/)
  const candidate = day ? `${day[1]}-${day[2]}-${day[3]}T00:00:00+09:00` : input.trim()
  // Accept explicit-zone ISO/RFC dates; never infer timezone from server locale.
  if (!day && !/(Z|[+-]\d{2}:?\d{2}|GMT|UTC)\s*$/i.test(candidate)) return { publishedAt: null, datePrecision: "unknown" }
  const date = new Date(candidate)
  const isoDay = candidate.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1]
  if (!Number.isFinite(date.getTime()) || (isoDay && new Date(`${isoDay}T00:00:00Z`).toISOString().slice(0, 10) !== isoDay)) return { publishedAt: null, datePrecision: "unknown" }
  return { publishedAt: date.toISOString(), datePrecision: "day" }
}
export function normalizeSourceDocument(provider: SourceProvider, input: CollectedSourceDocument, collectedAt: string) {
  sourceProviderSchema.parse(provider)
  assertProviderUrl(input.originalUrl, provider)
  const canonicalUrl = canonicalizeSourceUrl(input.canonicalUrl ?? input.originalUrl, provider.urlPolicy)
  assertProviderUrl(canonicalUrl, provider)
  const title = normalizeMeaningfulText(input.title), text = normalizeMeaningfulText(input.text)
  let imageUrl: string | null = null
  if (input.imageUrl) {
    try { const image = new URL(input.imageUrl, input.originalUrl); if (["http:", "https:"].includes(image.protocol) && !image.username && !image.password) imageUrl = image.toString() } catch { /* Invalid optional image is absent, never fetched here. */ }
  }
  return normalizedSourceSchema.parse({ trust: "UNTRUSTED_SOURCE_DATA", providerId: provider.id, providerKey: provider.key, originalUrl: input.originalUrl, canonicalUrl, title, ...normalizePublishedDate(input.publishedDate), author: input.author ? normalizeMeaningfulText(input.author) : null, text, html: input.html, imageUrl, imageSource: imageUrl ? input.imageSource ?? input.originalUrl : null, collectedAt, contentHash: contentHash(title, text), externalId: input.externalId, metadata: input.metadata })
}
