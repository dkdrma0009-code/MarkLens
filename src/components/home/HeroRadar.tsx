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
  const selected = stories[active]

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

  return <>
    <div className="ml-hero-visual ml-radar-media" ref={media} {...interaction}>
      <div className="ml-hero-visual-top"><span>THE EDITORIAL LENS</span><span>{selected.category}</span></div>
      <Link href={selected.href} className="ml-hero-image-link" aria-label={selected.title}>
        <div className="ml-radar-frames">{visuals.map((visual, index) => <div key={stories[index].id} className={`ml-radar-frame${active === index ? " ml-radar-frame-active" : ""}`} aria-hidden={active !== index}>{visual}</div>)}</div>
      </Link>
      <div className="ml-hero-caption" key={selected.id}><span className="ml-eyebrow">IN FOCUS</span><Link href={selected.href}>{selected.title} <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
    </div>
    {stories.length > 1 ? <aside className="ml-hero-radar" aria-labelledby="radar-title" {...interaction}>
      <div className="ml-radar-label"><span className="ml-signal-dot" aria-hidden="true" /><p className="ml-eyebrow">ON THE RADAR</p></div>
      <h2 id="radar-title">지금, 읽어야 할<br />다음 이야기.</h2>
      {stories.slice(1).map((item, index) => <article key={item.id} className={active === index + 1 ? "ml-radar-current" : undefined}>
        <p className="ml-category">{item.category}</p><h3><Link href={item.href}>{item.title}<ArrowUpRight size={16} aria-hidden="true" /></Link></h3><p className="ml-radar-meta">{item.source} · <time dateTime={item.dateTime}>{item.date}</time></p>
      </article>)}
      <div className="ml-radar-controls" ref={controls}>
        <div className="ml-radar-progress" aria-hidden="true"><span key={active} /></div>
        <div><span className="ml-radar-count" aria-label={`선택된 이야기 ${active + 1}, 전체 ${stories.length}`}>{String(active + 1).padStart(2, "0")} / {String(stories.length).padStart(2, "0")}</span>
          <button type="button" onClick={() => move(-1)} aria-label="이전 Radar 이야기"><ArrowLeft size={14} aria-hidden="true" /></button>
          <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Radar 자동 재생 시작" : "Radar 자동 재생 일시정지"} aria-pressed={paused}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}</button>
          <button type="button" onClick={() => move(1)} aria-label="다음 Radar 이야기"><ArrowRight size={14} aria-hidden="true" /></button>
        </div>
      </div>
      <Link href="/insights" className="ml-text-link">새로운 관점 탐색 <ArrowRight size={16} aria-hidden="true" /></Link>
    </aside> : null}
  </>
}
