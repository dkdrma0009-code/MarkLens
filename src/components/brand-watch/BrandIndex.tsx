import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { PublicBrandCard } from "@/lib/brand-watch/public/types"
import { EvidenceImage } from "./EvidenceImage"
import { formatDay, isoDay, keepDots } from "./format"

// Intelligence index: one row per launch brand with its current signal and real counts.
// Only reviewed, published data is shown; there are no scores, rankings or charts. The small crop is the brand's
// lead visual evidence (a source's own image), there only as a quiet identity cue.
export default function BrandIndex({ cards }: { cards: PublicBrandCard[] }) {
  const failed = cards.length > 0 && cards.every(card => card.kind === "error")
  return (
    <div className="bw-public">
      <header className="bw-hero bw-index-hero">
        <div className="ml-container">
          <p className="ml-eyebrow bw-hero-eyebrow">BRAND WATCH</p>
          <h1>브랜드의 최근 움직임에서<br />반복되는 방향을 읽습니다<span className="ml-blue">.</span></h1>
          <ol className="bw-legend" aria-label="Brand Watch를 읽는 순서">
            <li><span className="bw-label bw-label-fact">FACT</span>공개 자료로 확인된 움직임</li>
            <li><span className="bw-label bw-label-pattern">OBSERVED PATTERN</span>반복해서 나타난 방향</li>
            <li><span className="bw-label bw-label-take">MARKLENS TAKE</span>MarkLens의 해석</li>
          </ol>
        </div>
      </header>
      <section className="bw-section bw-directory-section" aria-labelledby="directory-title">
        <div className="ml-container">
          <div className="bw-directory-top">
            <h2 id="directory-title">Watchlist<span className="ml-blue">.</span></h2>
            <p className="bw-principle">점수나 순위를 매기지 않습니다. 검수를 마친 공개 자료와, 그것과 분리해 표시한 MarkLens의 해석만 보여줍니다.</p>
          </div>
          {failed ? <p className="bw-notice-inline" role="status">Brand Watch 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p> : null}
          <div className="bw-directory-head" aria-hidden="true"><span>Brand</span><span>Current signal</span><span>Moves</span><span>Patterns</span><span>Updated</span></div>
          <ol className="bw-directory">
            {cards.map((card, index) => {
              const available = card.kind === "available"
              return (
                <li key={card.brand.slug}>
                  <Link href={`/brands/${card.brand.slug}`} className={`bw-dir-row${available ? "" : " bw-dir-row-quiet"}`}>
                    <span className="bw-dir-brand">
                      <span className="ml-index bw-dir-index">{String(index + 1).padStart(2, "0")}</span>
                      {card.visual ? <span className="bw-dir-visual"><EvidenceImage visual={card.visual} width={240} decorative /></span> : null}
                      <span className="bw-dir-name">{card.brand.displayName}</span>
                      <span className="bw-dir-ko">{card.brand.displayNameSecondary} · {card.brand.category}</span>
                    </span>
                    <span className="bw-dir-signal">
                      <span className="bw-dir-label">Current signal</span>
                      {card.signal && card.signal.kind !== "snapshot" ? <span className="bw-dir-kind">{card.signal.kind === "pattern" ? "Observed direction" : "Latest move"}</span> : null}
                      <span className={card.signal ? "bw-dir-headline" : "bw-dir-muted"}>{card.signal ? keepDots(card.signal.text) : directionFallback(card)}</span>
                    </span>
                    <span className="bw-dir-count"><span className="bw-dir-label">Moves</span><span>{available ? card.movementCount : "—"}</span></span>
                    <span className="bw-dir-count"><span className="bw-dir-label">Patterns</span><span>{available ? card.patternCount : "—"}</span></span>
                    <span className="bw-dir-updated"><span className="bw-dir-label">Updated</span>{card.lastUpdate ? <time dateTime={isoDay(card.lastUpdate)}>{formatDay(card.lastUpdate)}</time> : <span>—</span>}</span>
                    <ArrowUpRight className="bw-dir-arrow" size={18} aria-hidden="true" />
                  </Link>
                </li>
              )
            })}
          </ol>
        </div>
      </section>
    </div>
  )
}

function directionFallback(card: PublicBrandCard) {
  if (card.kind === "error") return "데이터를 불러오지 못했습니다."
  if (card.kind === "unavailable") return "아직 공개된 Brand Watch 데이터가 없습니다."
  return "현재 공개된 Brand Snapshot이 없습니다."
}
