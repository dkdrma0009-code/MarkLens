import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { headline, formatDate, type HomeInsight } from "./data"

export default function Signals({ insights, since, until }: { insights: HomeInsight[]; since: string; until: string }) {
  return (
    <section id="signals" className="ml-section ml-signals" aria-labelledby="signals-title" data-reveal>
      <div className="ml-container">
        <div className="ml-section-heading"><div><p className="ml-eyebrow">READ THE CHANGE</p><h2 id="signals-title">This Week’s Signals<span className="ml-blue">.</span></h2></div><p>최근 7일 분석 · {formatDate(since)}–{formatDate(until)}</p></div>
        <p className="ml-section-deck">이번 주 더 깊이 읽을 변화. 주제의 다양성과 분석 맥락을 기준으로 골랐습니다.</p>
        <div className="ml-signal-list">
          {insights.length ? insights.map((i, index) => <article key={i.id}>
            <span className="ml-index">{String(index + 1).padStart(2, "0")}</span>
            <p className="ml-category">{i.category}</p>
            <div><h3><Link href={`/insights/${i.slug}`}>{headline(i)}</Link></h3>{i.summary ? <p className="ml-signal-observation">{i.summary}</p> : null}<div className="ml-meta"><span>{i.article?.source_name || "MarkLens"}</span><span>분석 <time dateTime={i.created_at}>{formatDate(i.created_at)}</time></span></div></div>
            <Link href={`/insights/${i.slug}`} className="ml-signal-arrow" aria-label={`${headline(i)} 읽기`}><ArrowUpRight size={22} aria-hidden="true" /></Link>
          </article>) : <p className="ml-empty">최근 7일 동안 분석된 공개 인사이트가 없습니다. <Link href="/insights">전체 인사이트 보기 →</Link></p>}
        </div>
      </div>
    </section>
  )
}
