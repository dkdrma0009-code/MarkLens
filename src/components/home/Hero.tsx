import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import EditorialImage from "./EditorialImage"
import { headline, type HomeInsight } from "./data"

export default function Hero({ story }: { story?: HomeInsight }) {
  return (
    <section className="ml-hero" aria-labelledby="hero-title">
      <div className="ml-container">
        <div className="ml-hero-grid">
          <div className="ml-hero-copy">
            <p className="ml-eyebrow">MARKETING INTELLIGENCE</p>
            <h1 id="hero-title"><span>FOR THE NEXT</span><span>GENERATION.</span></h1>
            <p className="ml-hero-korean">마케팅 트렌드를 읽고,<br />실무를 준비하다.</p>
            <p className="ml-hero-description">변화를 읽는 시선에서, 다음을 만드는 실행으로.<br />마케터를 위한 트렌드와 실무 인사이트.</p>
            <div className="ml-hero-ctas">
              <Link href="/insights" className="ml-button ml-button-blue">최신 인사이트 보기 <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/about" className="ml-text-link">MarkLens 소개 <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="ml-hero-visual">
            <div className="ml-hero-visual-top"><span>THE EDITORIAL LENS</span><span>{story?.category || "MARKLENS"}</span></div>
            {story ? <Link href={`/insights/${story.slug}`} className="ml-hero-image-link" aria-label={headline(story)}><EditorialImage key={story.id} insight={story} sizes="(max-width: 767px) 100vw, 55vw" eager /></Link> : <div className="ml-hero-image-link"><EditorialImage sizes="(max-width: 767px) 100vw, 55vw" /></div>}
            <div className="ml-hero-caption"><span className="ml-eyebrow">IN FOCUS</span>{story ? <Link href={`/insights/${story.slug}`}>{headline(story)} <ArrowUpRight size={18} aria-hidden="true" /></Link> : <p>발행된 인사이트를 준비하고 있습니다.</p>}</div>
          </div>
        </div>
        <div className="ml-hero-bottom"><span>Marketing × Trend × Intelligence</span><span>Where Marketing Trends Become Action</span></div>
      </div>
    </section>
  )
}
