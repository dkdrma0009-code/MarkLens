import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { PublicBrandCard } from "@/lib/brand-watch/public/types"
import { formatDay, formatPublicDate, isoDay } from "./format"

// Publication directory: one editorial row per launch brand. Only reviewed, published data is shown;
// there are no scores, rankings or charts.
export default function BrandIndex({ cards }: { cards: PublicBrandCard[] }) {
  const failed = cards.length > 0 && cards.every(card => card.kind === "error")
  return (
    <div className="bw-public">
      <header className="bw-hero bw-index-hero">
        <div className="ml-container">
          <p className="ml-eyebrow bw-hero-eyebrow">BRAND WATCH</p>
          <h1>How brands are moving.<span className="bw-hero-second">And what those moves may mean.</span></h1>
          <p className="bw-index-deck">최근 공개 자료와 마케팅 움직임을 MarkLens가 연결해 읽습니다.</p>
          <ol className="bw-index-layers" aria-label="Brand Watch를 읽는 순서">
            <li><span className="bw-label bw-label-fact">FACT</span>공개 자료로 확인된 움직임</li>
            <li><span className="bw-label bw-label-pattern">OBSERVED PATTERN</span>반복해서 나타난 방향</li>
            <li><span className="bw-label bw-label-take">MARKLENS TAKE</span>MarkLens의 해석</li>
          </ol>
        </div>
      </header>
      <section className="bw-section bw-directory-section" aria-labelledby="directory-title">
        <div className="ml-container">
          <div className="bw-heading"><p className="ml-eyebrow">WATCHLIST</p><h2 id="directory-title">브랜드를 고르세요<span className="ml-blue">.</span></h2></div>
          {failed ? <p className="bw-notice-inline" role="status">Brand Watch 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p> : null}
          <ol className="bw-directory">
            {cards.map((card, index) => (
              <li key={card.brand.slug}>
                <Link href={`/brands/${card.brand.slug}`} className="bw-dir-row">
                  <span className="ml-index bw-dir-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="bw-dir-brand">
                    <span className="bw-dir-name">{card.brand.name}</span>
                    <span className="bw-dir-ko">{card.brand.nameKo} · {card.brand.category}</span>
                  </span>
                  <span className="bw-dir-direction">
                    <span className="bw-label">CURRENT DIRECTION</span>
                    <span className={card.headline ? "bw-dir-headline" : "bw-dir-muted"}>{card.headline ?? directionFallback(card)}</span>
                  </span>
                  <span className="bw-dir-moves">
                    <span className="bw-label">RECENT MOVES</span>
                    {card.recentMovements.length ? (
                      <span className="bw-dir-move-list">{card.recentMovements.map((move, moveIndex) => <span key={moveIndex} className="bw-dir-move">{move.date ? <time dateTime={move.date.date}>{formatPublicDate(move.date)}</time> : null}<span>{move.title}</span></span>)}</span>
                    ) : <span className="bw-dir-muted">{card.kind === "available" ? "공개된 움직임이 아직 없습니다." : "—"}</span>}
                  </span>
                  <span className="bw-dir-updated">{card.lastUpdate ? <><time dateTime={isoDay(card.lastUpdate)}>{formatDay(card.lastUpdate)}</time> 기준</> : null}</span>
                  <ArrowUpRight className="bw-dir-arrow" size={18} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
          <p className="bw-principle">Brand Watch는 점수나 순위를 매기지 않습니다. 검수를 마친 공개 자료와, 그것과 분리해 표시한 MarkLens의 해석만 보여줍니다.</p>
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
