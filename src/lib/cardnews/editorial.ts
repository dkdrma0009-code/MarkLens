import type { EditorialRole, Slide } from "./types"

export type VisualFamily = "photo" | "data" | "typography"
export interface SourceMetric { value: string; statement: string; source: string; date: string }
export interface EditorialContext {
  family: VisualFamily
  image?: { dataUri: string; width: number; height: number } | null
  metric?: SourceMetric | null
  source?: string
  date?: string
  photoCrop?: boolean
}

export const ROLE_LABELS: Record<EditorialRole, string> = {
  hook: "HOOK", what: "WHAT HAPPENED", context: "SIGNAL / CONTEXT", why: "WHY IT MATTERS",
  take: "MARKLENS TAKE", action: "ACTION", end: "MARKLENS",
}

export function categoryLabel(category: string): string {
  if (/career|커리어|취업|포트폴리오/i.test(category)) return "CAREER"
  if (/strategy|전략|framework|프레임워크|SEO|CRM/i.test(category)) return "STRATEGY"
  if (/campaign|캠페인/i.test(category)) return "CAMPAIGN"
  if (/creator|크리에이터|인플루언서/i.test(category)) return "CREATOR"
  if (/retail|리테일|유통/i.test(category)) return "RETAIL"
  if (/social|소셜/i.test(category)) return "SOCIAL"
  if (/\bAI\b|인공지능/i.test(category)) return "AI"
  if (/data|데이터|퍼포먼스/i.test(category)) return "DATA"
  if (/brand|브랜딩/i.test(category)) return "BRAND"
  return "STRATEGY"
}

export function slideCopy(slide: Slide): { headline: string; body: string } {
  if (slide.type === "cover") return { headline: slide.headline.join(slide.role ? "\n" : " "), body: slide.sub ?? "" }
  if (slide.type === "keywords") return { headline: "", body: slide.keywords.map(k => [k.word, k.desc].filter(Boolean).join(" · ")).join("\n") }
  return { headline: "headline" in slide ? slide.headline : "", body: slide.body }
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim()

// A number alone is not evidence. Only an exact factual statement present in the
// original article, with a named source and date, is eligible for a DATA treatment.
export function sourceMetric(slides: Slide[], raw: string, source: string, date: string): SourceMetric | null {
  if (!raw || !source || !date) return null
  for (const slide of slides) {
    if (slide.role !== "what" && slide.role !== "context") continue
    const body = normalize(slideCopy(slide).body)
    if (body.length < 12 || !normalize(raw).includes(body) || /추정|예상|전망|약\s*\d|estimated|forecast|projected/i.test(body)) continue
    const value = body.match(/(?<![\d.,])\d+(?:[,.]\d+)*\s*(?:%|퍼센트|배|억\s*원|만\s*원|조\s*원|명|건)(?=\s|[.,!?;:)]|$|는|은|가|이|를|을|로|으로|와|과|에|였|입니다)/u)?.[0]
    if (value && [...value].length <= 14) return { value, statement: body, source, date }
  }
  return null
}

export function visualFamily(category: string, slides: Slide[], hasImage: boolean, metric: SourceMetric | null): VisualFamily {
  const cover = slides.find(s => s.type === "cover")
  const title = cover ? slideCopy(cover).headline : ""
  if (/career|커리어|취업|포트폴리오|면접|주니어|시니어|인재 육성|멘토링|framework|프레임워크|실무 팁/i.test(`${category} ${title}`) || /strategy|전략/i.test(category)) return "typography"
  if (metric) return "data"
  if (hasImage && (cover?.type !== "cover" || cover.usePhoto !== false)) return "photo"
  return "typography"
}

// Weighted line widths keep long Latin brands/numbers inside the same fixed type
// size as Korean. Break at words first, then graphemes; cap instead of shrinking.
export function editorialLines(text: string, width: number, maxLines: number): string[] {
  const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" })
  const glyphs = (s: string) => [...segmenter.segment(s)].map(g => g.segment)
  const units = (s: string) => glyphs(s).reduce((n, g) => n + (/^[WM%]$/.test(g) ? 1 : /^[\x00-\x7F]+$/.test(g) ? 0.78 : 1), 0)
  const lines: string[] = []
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = ""
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (units(candidate) <= width) { line = candidate; continue }
      if (line) { lines.push(line); line = "" }
      for (const glyph of glyphs(word)) {
        if (units(line + glyph) > width) { lines.push(line); line = "" }
        line += glyph
      }
    }
    if (line) lines.push(line)
  }
  if (lines.length <= maxLines) return lines
  const capped = lines.slice(0, maxLines)
  const last = glyphs(capped[maxLines - 1])
  while (units(last.join("") + "…") > width) last.pop()
  capped[maxLines - 1] = last.join("").replace(/[\s,;:]+$/, "") + "…"
  return capped
}
