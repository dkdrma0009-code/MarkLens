import type { NormalizedSourceDocument } from "../sources/types"
import type { SupportLocator } from "./schemas"

export const SUPPORT_NORMALIZATION_VERSION = "support-v1"
export function normalizeSupport(value: string): string {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " }
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt|nbsp);/gi, (original, key: string) => {
    if (!key.startsWith("#")) return entities[key.toLowerCase()] ?? original
    const number = key.slice(0, 2).toLowerCase() === "#x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10)
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : original
  }).normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/gu, " ").trim()
}
export function locateSupport(source: NormalizedSourceDocument, support: string, field: "title" | "text"): SupportLocator | null {
  const needle = normalizeSupport(support), content = normalizeSupport(source[field])
  if (needle.length < 8) return null
  const start = content.indexOf(needle)
  return start < 0 ? null : { field, start, end: start + needle.length, normalizationVersion: SUPPORT_NORMALIZATION_VERSION, sourceHash: source.contentHash }
}
export function numericTokens(value: string): string[] {
  return [...normalizeSupport(value).matchAll(/\d+(?:,\d{3})*(?:\.\d+)?%?/g)].map(match => match[0].replace(/,/g, ""))
}
export function sourceHasDate(content: string, date: string): boolean {
  const [year, month, day] = date.split("-")
  const normalized = normalizeSupport(content)
  return [date, `${year}.${month}.${day}`, `${year}/${month}/${day}`, `${year}년 ${Number(month)}월 ${Number(day)}일`, `${year}년${Number(month)}월${Number(day)}일`].some(value => new RegExp(`(?<!\\d)${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`).test(normalized))
}
