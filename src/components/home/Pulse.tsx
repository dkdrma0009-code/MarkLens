import Link from "next/link"
import { headline, type HomeInsight } from "./data"
import StoryMeta from "./StoryMeta"
import PulseTicker from "./PulseTicker"

export default function Pulse({ insights }: { insights: HomeInsight[] }) {
  return (
    <section className="ml-pulse" aria-labelledby="pulse-title">
      <div className="ml-container">
        <div className="ml-pulse-label"><h2 id="pulse-title">MarkLens Pulse<span aria-hidden="true">↗</span></h2><p>WHAT IS MOVING NOW · 지금 읽을 변화</p></div>
        <PulseTicker count={insights.length} duplicate={insights.map((i, index) => <article key={i.id}><div><span className="ml-index">{String(index + 1).padStart(2, "0")}</span><span className="ml-category">{i.category}</span><h3>{headline(i)}</h3></div><StoryMeta insight={i} /></article>)}>
        <div className="ml-pulse-items">
          {insights.length ? insights.map((i, index) => <article key={i.id} data-reveal data-delay={index * 65}>
            <Link href={`/insights/${i.slug}`}><span className="ml-index">{String(index + 1).padStart(2, "0")}</span><span className="ml-category">{i.category}</span><h3>{headline(i)}</h3></Link>
            <StoryMeta insight={i} />
          </article>) : <p className="ml-empty">발행된 인사이트가 아직 없습니다.</p>}
        </div>
        </PulseTicker>
      </div>
    </section>
  )
}
