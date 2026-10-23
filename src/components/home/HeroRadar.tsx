"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react"

type RadarStory = { id: string; href: string; title: string; category: string; source: string; date: string; dateTime: string }

// C-2 Panel B: today's insight and the next stories in one compact panel. Stories change only when the reader presses
// previous / next (wrapping around); nothing advances on its own. Inactive stories stay mounted (their thumbnails load
// once) but are inert and hidden from assistive technology, so only the shown story is reachable.
export default function HeroRadar({ stories, visuals }: { stories: RadarStory[]; visuals: ReactNode[] }) {
  const [active, setActive] = useState(0)
  const move = (direction: number) => setActive(index => (index + direction + stories.length) % stories.length)

  return <aside className="ml-hero-panel" aria-labelledby="hero-panel-title">
    <h2 id="hero-panel-title" className="ml-hero-panel-label">오늘의 인사이트</h2>
    {stories.length > 1 ? <div className="ml-radar-controls">
      <span className="ml-radar-count" aria-hidden="true">{String(active + 1).padStart(2, "0")} / {String(stories.length).padStart(2, "0")}</span>
      <span className="sr-only" aria-live="polite">{`전체 ${stories.length}개 중 ${active + 1}번째 이야기`}</span>
      <button type="button" onClick={() => move(-1)} aria-label="이전 이야기"><ArrowLeft size={16} aria-hidden="true" /></button>
      <button type="button" onClick={() => move(1)} aria-label="다음 이야기"><ArrowRight size={16} aria-hidden="true" /></button>
    </div> : null}
    <div className="ml-hero-stories">{stories.map((item, index) => <article key={item.id} className="ml-hero-story" data-active={active === index} aria-hidden={active !== index || undefined} inert={active !== index}>
      <p className="ml-hero-story-meta"><span className="ml-hero-story-category">{item.category}</span> · {item.source} · <time dateTime={item.dateTime}>{item.date}</time></p>
      <Link href={item.href} className="ml-hero-story-link">
        <span className="ml-hero-story-thumb">{visuals[index]}</span>
        <h3>{item.title}</h3>
        <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
    </article>)}</div>
  </aside>
}
