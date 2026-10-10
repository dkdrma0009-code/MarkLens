import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { headline, formatDate, type HomeInsight } from "./data"

export default function Signals({ insights, since, until }: { insights: HomeInsight[]; since: string; until: string }) {
  return (
    <section id="signals" className="ml-section ml-signals" aria-labelledby="signals-title" data-reveal>
      <div className="ml-container">
        <div className="ml-signals-layout"><div className="ml-signals-sticky">
        <div className="ml-section-heading"><div><p className="ml-eyebrow">THIS WEEK’S INTELLIGENCE</p><h2 id="signals-title">Signals<span className="ml-blue">.</span></h2></div><p>최근 7일 분석 · {formatDate(since)}–{formatDate(until)}</p></div>
        <div className="ml-signals-intro"><span className="ml-signal-mark" aria-hidden="true">↗</span><p className="ml-section-deck">변화의 소음 속에서,<br />읽어야 할 신호를 고릅니다.</p><p className="ml-signal-note">주제의 다양성과 분석 맥락으로 고른 이번 주의 관점.</p><span className="ml-eyebrow">EDITORIAL READING ORDER</span></div></div>
        <div className="ml-signal-list">
          {insights.length ? insights.map((i, index) => <article key={i.id}>
            <span className="ml-index" aria-label={`읽기 순서 ${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
            <div><p className="ml-category">{i.category}</p><h3><Link href={`/insights/${i.slug}`}>{headline(i)}</Link></h3>{i.summary ? <p className="ml-signal-observation">{i.summary}</p> : null}<div className="ml-meta"><span>{i.article?.source_name || "MarkLens"}</span><span>분석 <time dateTime={i.created_at}>{formatDate(i.created_at)}</time></span></div></div>
            <Link href={`/insights/${i.slug}`} className="ml-signal-arrow" aria-label={`${headline(i)} 읽기`}><ArrowUpRight size={22} aria-hidden="true" /></Link>
          </article>) : <p className="ml-empty">최근 7일 동안 분석된 공개 인사이트가 없습니다. <Link href="/insights">전체 인사이트 보기 →</Link></p>}
        </div>
        </div>
      </div>
    </section>
  )
}
