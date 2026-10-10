import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import EditorialImage from "./EditorialImage"
import HeroRadar from "./HeroRadar"
import { headline, formatDate, type HomeInsight } from "./data"

export default function Hero({ story, radar, children }: { story?: HomeInsight; radar: HomeInsight[]; children: ReactNode }) {
  const stories = story ? [story, ...radar] : radar
  return (
    <section className="ml-hero" aria-labelledby="hero-title">
      <div className="ml-container">
        <div className="ml-hero-grid">
          <div className="ml-hero-copy">
            <p className="ml-eyebrow">MARKETING INTELLIGENCE</p>
            <h1 id="hero-title"><span className="ml-hero-line"><span>FOR THE</span></span>{" "}<span className="ml-hero-line"><span>NEXT</span></span>{" "}<span className="ml-hero-line"><span>GENERATION.</span></span></h1>
            <p className="ml-hero-korean">마케팅 트렌드를 읽고,<br />실무를 준비하다.</p>
            <p className="ml-hero-description">변화를 읽는 시선에서, 다음을 만드는 실행으로.<br />마케터를 위한 트렌드와 실무 인사이트.</p>
            <div className="ml-hero-ctas">
              <Link href="/insights" className="ml-button ml-button-blue">최신 인사이트 보기 <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/about" className="ml-text-link">MarkLens 소개 <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
          {stories.length ? <HeroRadar
            stories={stories.map(item => ({ id: item.id, href: `/insights/${item.slug}`, title: headline(item), category: item.category || "MARKLENS", source: item.article?.source_name || "MarkLens", date: formatDate(item.created_at), dateTime: item.created_at }))}
            visuals={stories.map((item, index) => <EditorialImage key={item.id} insight={item} sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 36vw" eager={index === 0} />)}
          /> : <div className="ml-hero-visual">
            <div className="ml-hero-visual-top"><span>THE EDITORIAL LENS</span><span>MARKLENS</span></div>
            <div className="ml-hero-image-link"><EditorialImage sizes="(max-width: 767px) 100vw, 36vw" /></div>
            <div className="ml-hero-caption"><span className="ml-eyebrow">IN FOCUS</span><p>발행된 인사이트를 준비하고 있습니다.</p></div>
          </div>}
        </div>
        <div className="ml-hero-bottom"><span>Marketing × Trend × Intelligence</span><span>Where Marketing Trends Become Action</span></div>
      </div>
      {children}
    </section>
  )
}
