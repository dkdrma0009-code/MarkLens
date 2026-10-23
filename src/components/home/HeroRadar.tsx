"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react"

type RadarStory = { id: string; href: string; title: string; category: string; source: string; date: string; dateTime: string }

export default function HeroRadar({ stories, visuals }: { stories: RadarStory[]; visuals: ReactNode[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const media = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const cycle = useRef({ index: 0, remaining: 6000, started: 0 })

  useEffect(() => {
    const element = media.current
    const progress = controls.current
    if (!element || !progress || stories.length < 2) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let visible = false
    let timer: ReturnType<typeof setTimeout> | undefined
    if (cycle.current.index !== active) cycle.current = { index: active, remaining: 6000, started: 0 }
    const stop = () => {
      if (timer) cycle.current.remaining = Math.max(0, cycle.current.remaining - (performance.now() - cycle.current.started))
      clearTimeout(timer)
      timer = undefined
      progress.dataset.running = "false"
    }
    const sync = () => {
      stop()
      if (!visible || document.hidden || reduced.matches || paused || hovered || focused) return
      progress.dataset.running = "true"
      cycle.current.started = performance.now()
      timer = setTimeout(() => setActive(index => (index + 1) % stories.length), cycle.current.remaining)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() }, { threshold: .2 })
    observer.observe(element)
    document.addEventListener("visibilitychange", sync)
    reduced.addEventListener("change", sync)
    return () => { stop(); observer.disconnect(); document.removeEventListener("visibilitychange", sync); reduced.removeEventListener("change", sync) }
  }, [active, paused, hovered, focused, stories.length])

  const interaction = {
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => { if (event.pointerType === "mouse") setHovered(true) },
    onPointerLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: (event: React.FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) },
  }
  const move = (direction: number) => setActive(index => (index + direction + stories.length) % stories.length)

  // C-2 Panel B: the same stories, rotation and controls in one compact panel. The controls come before the stories (the
  // carousel order assistive technology expects). Inactive stories stay mounted (their thumbnails load once) but are
  // inert and hidden from assistive technology, so only the shown story is reachable.
  return <aside className="ml-hero-panel" aria-labelledby="hero-panel-title" ref={media} {...interaction}>
    <h2 id="hero-panel-title" className="ml-hero-panel-label">오늘의 인사이트</h2>
    {stories.length > 1 ? <div className="ml-radar-controls" ref={controls}>
      <div className="ml-radar-progress" aria-hidden="true"><span key={active} /></div>
      <span className="ml-radar-count" aria-hidden="true">{String(active + 1).padStart(2, "0")} / {String(stories.length).padStart(2, "0")}</span><span className="sr-only">{`전체 ${stories.length}개 중 ${active + 1}번째 이야기`}</span>
      <button type="button" onClick={() => move(-1)} aria-label="이전 이야기"><ArrowLeft size={16} aria-hidden="true" /></button>
      <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "자동 넘김 시작" : "자동 넘김 일시정지"} aria-pressed={paused}>{paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button>
      <button type="button" onClick={() => move(1)} aria-label="다음 이야기"><ArrowRight size={16} aria-hidden="true" /></button>
    </div> : null}
    <div className="ml-hero-stories">{stories.map((item, index) => <article key={item.id} className="ml-hero-story" data-active={active === index} aria-hidden={active !== index || undefined} inert={active !== index}>
      <Link href={item.href} className="ml-hero-story-link">
        <span className="ml-hero-story-thumb">{visuals[index]}</span>
        <span className="ml-hero-story-text"><span className="ml-hero-story-category">{item.category}</span><h3>{item.title}</h3></span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </Link>
      <p className="ml-hero-story-meta">{item.source} · <time dateTime={item.dateTime}>{item.date}</time></p>
    </article>)}</div>
  </aside>
}
