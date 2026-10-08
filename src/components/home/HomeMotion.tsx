"use client"

import { useEffect, useRef } from "react"

export default function HomeMotion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = rootRef.current
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!root || media.matches) return
    const animations: Animation[] = []
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        if (!media.matches) animations.push(entry.target.animate(
          [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 550, easing: "cubic-bezier(.2,.7,.2,1)", delay: Number((entry.target as HTMLElement).dataset.delay || 0) },
        ))
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.08 })
    root.querySelectorAll("[data-reveal]").forEach(el => observer.observe(el))
    const stop = () => { if (media.matches) { observer.disconnect(); animations.forEach(a => a.cancel()) } }
    media.addEventListener("change", stop)
    return () => { observer.disconnect(); animations.forEach(a => a.cancel()); media.removeEventListener("change", stop) }
  }, [])
  return <div className="ml-home" ref={rootRef}>{children}</div>
}
