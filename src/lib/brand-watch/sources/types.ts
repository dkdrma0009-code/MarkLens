import { z } from "zod"
import { providerTypes, datePrecisions } from "../taxonomy"

const httpUrl = z.url({ protocol: /^https?$/ })
export const sourceProviderSchema = z.strictObject({
  id: z.uuid(), key: z.string().min(1), entitySlug: z.string().min(1), name: z.string().min(1),
  domain: z.string().min(1), providerType: z.enum(providerTypes), sourceTier: z.number().int().min(1).max(3),
  adapter: z.enum(["rss", "newsroom"]), listingUrl: httpUrl,
  verification: z.enum(["VERIFIED", "NEEDS_VERIFICATION"]), robotsConfirmed: z.boolean(),
  verifiedAt: z.iso.date().nullable(), verificationNote: z.string(),
  urlPolicy: z.strictObject({ trailingSlash: z.enum(["preserve", "remove"]), removeQueryKeys: z.array(z.string()), equivalentHosts: z.array(z.string()) }),
  newsroom: z.strictObject({ linkSelector: z.string().min(1), detailPathPattern: z.string().min(1), titleSelector: z.string().min(1), bodySelector: z.string().min(1), dateSelector: z.string().nullable(), nextPageSelector: z.string().nullable() }).nullable(),
})
export type SourceProvider = z.infer<typeof sourceProviderSchema>

// All fields below are UNTRUSTED DATA. They never grant authority or become prompts.
export interface CollectedSourceDocument {
  originalUrl: string
  canonicalUrl?: string
  title: string
  publishedDate: string | null
  author: string | null
  text: string
  html: string | null
  imageUrl: string | null
  imageSource: string | null
  externalId: string | null
  metadata: Record<string, string>
}
export const normalizedSourceSchema = z.strictObject({
  trust: z.literal("UNTRUSTED_SOURCE_DATA"), providerId: z.uuid(), providerKey: z.string().min(1),
  originalUrl: httpUrl, canonicalUrl: httpUrl, title: z.string().min(1).max(1000),
  publishedAt: z.iso.datetime({ offset: true }).nullable(), datePrecision: z.enum(datePrecisions),
  author: z.string().max(1000).nullable(), text: z.string().min(1).max(200000), html: z.string().max(2000000).nullable(),
  imageUrl: httpUrl.nullable(), imageSource: z.string().nullable(), collectedAt: z.iso.datetime({ offset: true }),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), externalId: z.string().max(1000).nullable(),
  metadata: z.record(z.string().max(100), z.string().max(2000)),
}).refine(value => !value.imageUrl || Boolean(value.imageSource?.trim()), "Image provenance required")
export type NormalizedSourceDocument = z.infer<typeof normalizedSourceSchema>
export interface CollectionOptions { maxPages?: number; maxItems?: number; timeoutMs?: number; maxBytes?: number; fetch?: typeof globalThis.fetch }
export interface CollectionResult { documents: CollectedSourceDocument[]; issues: { url: string; code: string }[] }
export interface BrandWatchSourceAdapter {
  canHandle(provider: SourceProvider): boolean
  collect(provider: SourceProvider, options?: CollectionOptions): Promise<CollectionResult>
}
