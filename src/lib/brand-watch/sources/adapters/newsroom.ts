import { load } from "cheerio"
import { canonicalizeSourceUrl, assertProviderUrl } from "../canonicalize"
import { collectionLimits, fetchSource, requireVerifiedProvider, SourceFetchError } from "../fetch"
import type { BrandWatchSourceAdapter, CollectedSourceDocument, CollectionOptions, SourceProvider } from "../types"

export function discoverNewsroomUrls(html: string, pageUrl: string, provider: SourceProvider): string[] {
  if (!provider.newsroom) throw new SourceFetchError("MISSING_STRATEGY")
  const $ = load(html), urls = new Set<string>(), pattern = new RegExp(provider.newsroom.detailPathPattern)
  for (const element of $(provider.newsroom.linkSelector).toArray()) {
    try {
      const url = new URL($(element).attr("href") ?? "", pageUrl)
      assertProviderUrl(url.toString(), provider)
      if (pattern.test(url.pathname)) urls.add(canonicalizeSourceUrl(url.toString(), provider.urlPolicy))
    } catch { /* External/malformed discovery links are never fetched. */ }
  }
  return [...urls]
}
export function parseNewsroomDetail(html: string, originalUrl: string, provider: SourceProvider, resolvedUrl = originalUrl): CollectedSourceDocument {
  if (!provider.newsroom) throw new SourceFetchError("MISSING_STRATEGY")
  assertProviderUrl(originalUrl, provider)
  assertProviderUrl(resolvedUrl, provider)
  const $ = load(html)
  $("script,style,noscript,iframe,nav,footer,form").remove()
  const title = $(provider.newsroom.titleSelector).first().text().trim()
  const body = $(provider.newsroom.bodySelector).first()
  // Extract just the configured editorial body, never the surrounding homepage/navigation.
  body.find("br").replaceWith(" ")
  body.find("p,li,h2,h3,div").append(" ")
  const text = body.text().trim()
  if (!title || !text) throw new SourceFetchError("MALFORMED_DOCUMENT")
  const canonical = $("link[rel='canonical']").attr("href")
  let canonicalUrl = resolvedUrl
  if (canonical) { canonicalUrl = new URL(canonical, resolvedUrl).toString(); assertProviderUrl(canonicalUrl, provider) }
  const date = provider.newsroom.dateSelector ? $(provider.newsroom.dateSelector).first() : null
  const dateText = date?.text().match(/\d{4}[.\/-]\d{2}[.\/-]\d{2}/)?.[0] ?? null
  const image = body.find("img").first()
  const imageHref = image.attr("src") ?? image.attr("data-src") ?? $("meta[property='og:image']").attr("content")
  let imageUrl: string | null = null
  if (imageHref) { try { imageUrl = new URL(imageHref, resolvedUrl).toString() } catch { /* Optional malformed image is absent. */ } }
  return { originalUrl, canonicalUrl, title, publishedDate: date?.attr("datetime") ?? dateText, author: $("meta[name='author']").attr("content") ?? null, text, html: body.html(), imageUrl, imageSource: resolvedUrl, externalId: null, metadata: { strategy: "configured_newsroom" } }
}
export const newsroomAdapter: BrandWatchSourceAdapter = {
  canHandle: provider => provider.adapter === "newsroom" && provider.newsroom !== null,
  async collect(provider: SourceProvider, options: CollectionOptions = {}) {
    requireVerifiedProvider(provider)
    if (!this.canHandle(provider)) throw new SourceFetchError("MISSING_STRATEGY")
    const limits = collectionLimits(options), documents: CollectedSourceDocument[] = [], issues: { url: string; code: string }[] = []
    const visitedPages = new Set<string>(), discovered = new Set<string>()
    let pageUrl: string | null = provider.listingUrl
    for (let page = 0; page < limits.maxPages && pageUrl; page++) {
      const key = canonicalizeSourceUrl(pageUrl, provider.urlPolicy)
      if (visitedPages.has(key)) break
      visitedPages.add(key)
      const listing = await fetchSource(pageUrl, provider, "html", options)
      for (const url of discoverNewsroomUrls(listing.text, listing.url, provider)) {
        if (discovered.size >= limits.maxItems) break
        discovered.add(url)
      }
      const selector = provider.newsroom?.nextPageSelector
      const next = selector ? load(listing.text)(selector).first().attr("href") : undefined
      pageUrl = next && discovered.size < limits.maxItems ? new URL(next, listing.url).toString() : null
      if (pageUrl) assertProviderUrl(pageUrl, provider)
    }
    if (!discovered.size) issues.push({ url: provider.listingUrl, code: "NO_ARTICLE_LINKS" })
    for (const url of discovered) {
      try {
        const detail = await fetchSource(url, provider, "html", options)
        documents.push(parseNewsroomDetail(detail.text, url, provider, detail.url))
      } catch (error) {
        if (error instanceof SourceFetchError && error.code === "RATE_LIMIT") throw error
        issues.push({ url, code: error instanceof SourceFetchError ? error.code : "DETAIL_ERROR" })
      }
    }
    return { documents, issues }
  },
}
