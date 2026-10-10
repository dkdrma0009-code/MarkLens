"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Pause, Play } from "lucide-react"

export default function PulseTicker({ children, duplicate, count }: { children: ReactNode; duplicate: ReactNode; count: number }) {
  const root = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const element = root.current
    if (!element) return
    let visible = false
    const sync = () => { element.dataset.visible = String(visible && !document.hidden) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(element)
    document.addEventListener("visibilitychange", sync)
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync) }
  }, [])
  return <div className="ml-pulse-stream" ref={root} data-paused={paused} data-static={count < 2}>
    <div className="ml-pulse-window"><div className="ml-pulse-track">{children}<div className="ml-pulse-items ml-pulse-duplicate" aria-hidden="true" inert>{duplicate}</div></div></div>
    <button type="button" className="ml-pulse-toggle" onClick={() => setPaused(value => !value)} aria-label={paused ? "Pulse 흐름 시작" : "Pulse 흐름 일시정지"} aria-pressed={paused}>{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button>
  </div>
}
