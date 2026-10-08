import Link from "next/link"
import { ArrowRight } from "lucide-react"
import EditorialImage from "./EditorialImage"
import StoryMeta from "./StoryMeta"
import { headline, type HomeInsight } from "./data"

export default function LatestInsights({ insights }: { insights: HomeInsight[] }) {
  const [lead, ...supporting] = insights
  return (
    <section id="latest" className="ml-section ml-latest" aria-labelledby="latest-title" data-reveal>
      <div className="ml-container">
        <div className="ml-section-heading"><div><p className="ml-eyebrow">STAY AHEAD</p><h2 id="latest-title">Latest Insights<span className="ml-blue">.</span></h2></div><Link href="/insights" className="ml-text-link">모든 인사이트 <ArrowRight size={16} aria-hidden="true" /></Link></div>
        {lead ? <div className="ml-latest-grid">
          <article className="ml-latest-lead"><Link href={`/insights/${lead.slug}`} className="ml-latest-image" aria-label={headline(lead)}><EditorialImage key={lead.id} insight={lead} sizes="(max-width: 767px) 100vw, 55vw" /></Link><p className="ml-category">{lead.category}</p><h3><Link href={`/insights/${lead.slug}`}>{headline(lead)}</Link></h3>{lead.summary ? <p className="ml-latest-summary">{lead.summary}</p> : null}<StoryMeta insight={lead} /></article>
          <div className="ml-latest-supporting">{supporting.map(i => <article key={i.id}><Link href={`/insights/${i.slug}`} className="ml-supporting-image" aria-label={headline(i)}><EditorialImage insight={i} sizes="(max-width: 767px) 112px, 180px" /></Link><div><p className="ml-category">{i.category}</p><h3><Link href={`/insights/${i.slug}`}>{headline(i)}</Link></h3><StoryMeta insight={i} /></div></article>)}</div>
        </div> : <p className="ml-empty">새로운 인사이트가 발행되면 이곳에서 만나보세요.</p>}
      </div>
    </section>
  )
}
