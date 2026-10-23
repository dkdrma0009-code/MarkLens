import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import EditorialImage from "./EditorialImage"
import HeroCover from "./HeroCover"
import HeroRadar from "./HeroRadar"
import { headline, formatDate, type HomeInsight } from "./data"

export default function Hero({ story, radar, children }: { story?: HomeInsight; radar: HomeInsight[]; children: ReactNode }) {
  const stories = story ? [story, ...radar] : radar
  return (
    <section className="ml-hero" aria-labelledby="hero-title">
      <div className="ml-hero-stage">
        <HeroCover />
        <div className="ml-container">
          <div className="ml-hero-copy">
            <p className="ml-eyebrow">MARKETING × TREND × INTELLIGENCE</p>
            <h1 id="hero-title"><span className="ml-hero-line"><span>트렌드를 읽고,</span></span>{" "}<span className="ml-hero-line"><span>실무로 옮기다<span className="ml-hero-dot">.</span></span></span></h1>
            <p className="ml-hero-description">해외 마케팅 사례를 골라 무슨 일이 있었는지, 왜 중요한지, 어떻게 쓸 수 있는지 정리합니다.</p>
            <div className="ml-hero-ctas">
              <Link href="/insights" className="ml-button ml-button-blue">최신 인사이트 읽기 <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/brands" className="ml-button ml-hero-secondary">Brand Watch 보기</Link>
            </div>
          </div>
          {stories.length ? <HeroRadar
            stories={stories.map(item => ({ id: item.id, href: `/insights/${item.slug}`, title: headline(item), category: item.category || "MARKLENS", source: item.article?.source_name || "MarkLens", date: formatDate(item.created_at), dateTime: item.created_at }))}
            visuals={stories.map(item => <EditorialImage key={item.id} insight={item} sizes="96px" />)}
          /> : <aside className="ml-hero-panel" aria-labelledby="hero-panel-title">
            <h2 id="hero-panel-title" className="ml-hero-panel-label">오늘의 인사이트</h2>
            <p className="ml-hero-panel-empty">발행된 인사이트를 준비하고 있습니다.</p>
          </aside>}
          <p className="ml-hero-credit">커버 이미지 · AI로 생성한 가상 인물</p>
        </div>
      </div>
      {children}
    </section>
  )
}
