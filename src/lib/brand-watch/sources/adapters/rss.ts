import Parser from "rss-parser"
import { load } from "cheerio"
import { assertProviderUrl, canonicalizeSourceUrl } from "../canonicalize"
import { collectionLimits, fetchSource, SourceFetchError } from "../fetch"
import type { BrandWatchSourceAdapter, CollectedSourceDocument } from "../types"

export const rssAdapter: BrandWatchSourceAdapter = {
  canHandle: provider => provider.adapter === "rss",
  async collect(provider, options = {}) {
    if (!this.canHandle(provider)) throw new SourceFetchError("WRONG_ADAPTER")
    const limits = collectionLimits(options), response = await fetchSource(provider.listingUrl, provider, "rss", options)
    // No external entities, DTD expansion, parseURL's independent network or hidden retries.
    if (/<!DOCTYPE|<!ENTITY/i.test(response.text)) throw new SourceFetchError("UNSAFE_XML")
    const feed = await new Parser().parseString(response.text)
    const documents: CollectedSourceDocument[] = [], issues: { url: string; code: string }[] = [], seen = new Set<string>()
    for (const item of feed.items.slice(0, limits.maxItems)) {
      try {
        if (!item.title || !item.link) throw new SourceFetchError("MALFORMED_DOCUMENT")
        const url = new URL(item.link, response.url).toString(); assertProviderUrl(url, provider)
        const key = canonicalizeSourceUrl(url, provider.urlPolicy)
        if (seen.has(key)) continue
        seen.add(key)
        const rawHtml = item["content:encoded"] ?? item.content ?? null
        const $ = load(rawHtml ?? "")
        $("script,style,noscript,iframe").remove()
        $("p,div,li,br").append(" ")
        const text = rawHtml ? $.root().text().trim() : item.contentSnippet?.trim() ?? ""
        if (!text) throw new SourceFetchError("MALFORMED_DOCUMENT")
        const enclosure = item.enclosure
        const imageUrl = enclosure && (!enclosure.type || enclosure.type.startsWith("image/")) ? enclosure.url : $("img").first().attr("src") ?? null
        documents.push({ originalUrl: url, title: item.title, publishedDate: item.isoDate ?? item.pubDate ?? null, author: item.creator ?? item.author ?? null, text, html: rawHtml, imageUrl, imageSource: imageUrl ? response.url : null, externalId: item.guid ?? null, metadata: { strategy: "rss", feedTitle: (feed.title ?? "").slice(0, 2000) } })
      } catch (error) { issues.push({ url: item.link ?? response.url, code: error instanceof SourceFetchError ? error.code : "MALFORMED_DOCUMENT" }) }
    }
    return { documents, issues }
  },
}
