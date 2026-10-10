import Link from "next/link"
import { ArrowRight } from "lucide-react"
import EditorialImage from "./EditorialImage"
import StoryMeta from "./StoryMeta"
import { headline, type HomeInsight } from "./data"

export default function MainStory({ insight }: { insight?: HomeInsight }) {
  return (
    <section className="ml-section ml-main-story" aria-labelledby="main-story-title" data-reveal>
      <div className="ml-container">
        <div className="ml-section-heading"><div><p className="ml-eyebrow">THE BIG PICTURE</p><h2 id="main-story-title">Main Story<span className="ml-blue">.</span></h2></div><p>지금, 더 깊이 읽어야 할 이야기</p></div>
        {insight ? <article className="ml-main-grid">
          <Link href={`/insights/${insight.slug}`} className="ml-main-image" aria-label={headline(insight)}><EditorialImage key={insight.id} insight={insight} sizes="(max-width: 767px) 100vw, 65vw" /><span className="ml-main-photo-label">THE MAIN STORY <span aria-hidden="true">↗</span></span></Link>
          <div className="ml-main-copy"><p className="ml-category">{insight.category}</p><h3><Link href={`/insights/${insight.slug}`}>{headline(insight)}</Link></h3>{insight.summary ? <p className="ml-main-summary">{insight.summary}</p> : null}<StoryMeta insight={insight} /><Link href={`/insights/${insight.slug}`} className="ml-text-link">전체 내용 보기 <ArrowRight size={17} aria-hidden="true" /></Link></div>
        </article> : <p className="ml-empty">발행된 이야기가 준비되면 이곳에서 소개합니다.</p>}
      </div>
    </section>
  )
}
