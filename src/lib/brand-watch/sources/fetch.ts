import { assertProviderUrl } from "./canonicalize"
import { sourceProviderSchema, type CollectionOptions, type SourceProvider } from "./types"

export class SourceFetchError extends Error {
  constructor(public readonly code: string) { super(code) }
}
export function collectionLimits(options: CollectionOptions = {}) {
  const bounded = (value: number | undefined, fallback: number, ceiling: number) => {
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) throw new SourceFetchError("INVALID_LIMIT")
    return Math.min(value ?? fallback, ceiling)
  }
  return { maxPages: bounded(options.maxPages, 1, 3), maxItems: bounded(options.maxItems, 10, 25), timeoutMs: bounded(options.timeoutMs, 10000, 30000), maxBytes: bounded(options.maxBytes, 2000000, 2000000) }
}
export function requireVerifiedProvider(provider: SourceProvider) {
  sourceProviderSchema.parse(provider)
  assertProviderUrl(provider.listingUrl, provider)
  if (provider.verification !== "VERIFIED" || !provider.robotsConfirmed) throw new SourceFetchError("NEEDS_VERIFICATION")
}
export async function fetchSource(input: string, provider: SourceProvider, kind: "html" | "rss", options: CollectionOptions = {}) {
  requireVerifiedProvider(provider)
  const limits = collectionLimits(options), controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs)
  let url = input
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      assertProviderUrl(url, provider)
      const response = await (options.fetch ?? globalThis.fetch)(url, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": "MarkLens-BrandWatch/1.0" } })
      if (response.status === 429) { await response.body?.cancel(); throw new SourceFetchError("RATE_LIMIT") }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location"); await response.body?.cancel()
        if (!location || redirects === 3) throw new SourceFetchError("REDIRECT_LIMIT")
        url = new URL(location, url).toString(); continue
      }
      if (!response.ok) { await response.body?.cancel(); throw new SourceFetchError(`HTTP_${response.status}`) }
      const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
      const allowed = kind === "html" ? ["text/html", "application/xhtml+xml"] : ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"]
      if (!allowed.includes(type)) { await response.body?.cancel(); throw new SourceFetchError("CONTENT_TYPE") }
      if (Number(response.headers.get("content-length")) > limits.maxBytes) { await response.body?.cancel(); throw new SourceFetchError("SIZE_LIMIT") }
      if (!response.body) throw new SourceFetchError("EMPTY_BODY")
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0
      try {
        while (true) {
          const result = await reader.read(); if (result.done) break
          bytes += result.value.byteLength
          if (bytes > limits.maxBytes) { await reader.cancel(); throw new SourceFetchError("SIZE_LIMIT") }
          chunks.push(result.value)
        }
      } finally { reader.releaseLock() }
      return { url, text: Buffer.concat(chunks).toString("utf8") }
    }
    throw new SourceFetchError("REDIRECT_LIMIT")
  } catch (error) {
    if (controller.signal.aborted) throw new SourceFetchError("TIMEOUT")
    throw error
  } finally { clearTimeout(timer) }
}
