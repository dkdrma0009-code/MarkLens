// Public Brand Watch read model. Only these sanitized shapes reach rendering: no review state, actor,
// reason, model/prompt metadata, confidence, uncertainty note, raw source content or internal health code.

export type PublicDatePrecision = "day" | "month" | "year"
export interface PublicDate { date: string; precision: PublicDatePrecision; basis: "event" | "reported" | "observed" }

export interface PublicSource {
  ref: number // footnote number, stable within one brand page
  provider: string
  providerType: string
  title: string
  url: string
  publishedAt: string | null
}
export interface PublicFact { id: string; fact: string; date: PublicDate | null; sourceRef: number | null }
export interface PublicTheme { slug: string; name: string }
export type PublicVisualOrigin = "official" | "newsroom" | "media"
// Visual evidence: an image the source page itself publishes, shown only with that public footnoted source.
export interface PublicVisual { src: string; alt: string; sourceRef: number; provider: string; origin: PublicVisualOrigin; credit: string; fit: "cover" | "contain" }

export interface PublicMovement {
  id: string
  anchor: string
  title: string
  summary: string
  movementType: string
  date: PublicDate | null
  themes: PublicTheme[]
  facts: PublicFact[]
  sourceRefs: number[]
  providerCount: number
  visual: PublicVisual | null
}
export interface PublicPattern {
  id: string
  anchor: string
  title: string
  description: string
  windowStart: string
  windowEnd: string
  movementAnchors: { anchor: string; title: string }[]
  sourceRefs: number[]
  asOfOnly: boolean // freshness window passed: shown with its as-of date, never as current
}
export interface PublicTake {
  id: string
  anchor: string
  whatWeSee: string
  whyItMayMatter: string
  whatToWatchNext: string
  pattern: { anchor: string; title: string }
  sourceRefs: number[]
  asOfOnly: boolean
}
export interface PublicSnapshot {
  headline: string
  currentDirection: string
  watchNext: string | null
  asOf: string
  evidenceCount: number
  sourceCount: number
  takeAnchors: { anchor: string; patternTitle: string }[]
  asOfOnly: boolean
}
export interface PublicRelatedInsight { slug: string; title: string }

// displayName is the brand's own primary name for Korean-facing UI; displayNameSecondary is small metadata only.
export interface PublicBrandIdentity { slug: string; name: string; nameKo: string; displayName: string; displayNameSecondary: string; category: string }
// Lead line for a brand, with distinct semantics: a published Snapshot, else an Observed Pattern, else the latest Movement.
export interface PublicSignal { kind: "snapshot" | "pattern" | "movement"; text: string; anchor: string }

export type PublicBrandState =
  | { kind: "unavailable"; brand: PublicBrandIdentity }
  | { kind: "error"; brand: PublicBrandIdentity }
  | {
      kind: "available"
      brand: PublicBrandIdentity
      indexable: boolean
      lastUpdate: string | null
      snapshot: PublicSnapshot | null
      movements: PublicMovement[]
      patterns: PublicPattern[]
      takes: PublicTake[]
      sources: PublicSource[]
      themes: PublicTheme[]
      relatedInsights: PublicRelatedInsight[]
    }

export interface PublicBrandCard {
  brand: PublicBrandIdentity
  kind: PublicBrandState["kind"]
  headline: string | null
  recentMovements: { title: string; date: PublicDate | null }[]
  lastUpdate: string | null
  // Presentation counts of the already-public read model (no new data, never a score).
  movementCount: number
  patternCount: number
  signal: PublicSignal | null
  visual: PublicVisual | null
}
