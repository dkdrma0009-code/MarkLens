"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

// Progressive enhancement: SSR content is visible before hydration and without JS.
// Only editorial landmarks enter; article paragraphs and form controls never do.
const REVEAL_SELECTOR = [
  ".ml-home .ml-section-heading", ".ml-pulse-label", ".ml-pulse-items article",
  ".ml-main-image", ".ml-main-copy", ".ml-signal-list article",
  ".ml-latest-lead", ".ml-latest-supporting article", ".ml-action-steps article",
  ".ml-collection-topics", ".ml-collection-visual", ".ml-weekly-edition", ".ml-weekly h2", ".ml-weekly-subscribe",
  ".ml-feed-list", ".ml-article-image", ".ml-article-section > h2",
  ".ml-weekly-page .ml-page-section > .ml-eyebrow", ".ml-weekly-page .ml-editorial-row",
  ".ml-weekly-page .ml-page-cta", ".ml-footer-top",
].join(",")

export default function PublicMotion() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".marklens-public")
    if (!root) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const desktop = window.matchMedia("(min-width: 1024px)")
    const tokens = getComputedStyle(root)
    const duration = Number.parseFloat(tokens.getPropertyValue("--motion-base"))
    const slow = Number.parseFloat(tokens.getPropertyValue("--motion-slow"))
    const ease = tokens.getPropertyValue("--ease-editorial").trim()
    const seen = new WeakSet<Element>()
    const running = new Map<Element, Animation>()
    let hero: HTMLElement | null = null
    let heroTop = 0
    let heroHeight = 1
    let frame = 0
    let previousY = window.scrollY
    let compact = previousY > 64
    let signals: HTMLElement | null = null
    let signalRows: HTMLElement[] = []
    let mainImage: HTMLElement | null = null
    let signalGeometry: { top: number; height: number }[] = []
    let mainTop = 0
    let mainHeight = 1
    let activeSignal = -1

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const element = entry.target as HTMLElement
        observer.unobserve(element)
        element.dataset.motionSeen = "true"
        if (reduced.matches || element.matches(":focus-within")) continue
        const media = element.matches(".ml-main-image,.ml-collection-visual,.ml-article-image")
        const image = media ? element.querySelector("img") : null
        const target = image ?? element
        const row = element.matches(".ml-pulse-items article,.ml-signal-list article,.ml-action-steps article,.ml-latest-supporting article")
        const index = row ? Array.from(element.parentElement?.children ?? []).indexOf(element) : 0
        const delay = element.matches(".ml-main-copy") ? 100 : Math.min(index, 2) * 60
        const subtle = element.matches(".ml-article-section > h2,.ml-footer-top,.ml-section-heading")
        const animation = target.animate([
          { opacity: image ? 1 : .35, transform: image ? "scale(1.045)" : `translateY(${subtle ? 16 : 24}px)` },
          { opacity: 1, transform: image ? "scale(1)" : "translateY(0)" },
        ], { duration: image ? slow : duration, easing: ease, delay, fill: "backwards" })
        running.set(element, animation)
        animation.onfinish = () => running.delete(element)
      }
    }, { threshold: .1 })

    const measureHero = () => {
      hero = root.querySelector<HTMLElement>(".ml-hero-image-link")
      if (hero) {
        const rect = hero.getBoundingClientRect()
        heroTop = rect.top + window.scrollY
        heroHeight = rect.height
      }
      signals = root.querySelector<HTMLElement>(".ml-signals")
      signalRows = Array.from(root.querySelectorAll<HTMLElement>(".ml-signal-list article"))
      mainImage = root.querySelector<HTMLElement>(".ml-main-image .ml-image")
      signalGeometry = signalRows.map(row => { const r = row.getBoundingClientRect(); return { top: r.top + window.scrollY, height: r.height } })
      if (mainImage) { const main = mainImage.getBoundingClientRect(); mainTop = main.top + window.scrollY; mainHeight = main.height }
    }
    const updateScroll = () => {
      frame = 0
      const y = window.scrollY
      // A transform inside a fixed-height header keeps scroll/anchor layout stable.
      const header = root.querySelector<HTMLElement>(".ml-header")
      if (y < 64) compact = false
      else if (Math.abs(y - previousY) > 3) compact = y > previousY
      previousY = y
      header?.classList.toggle("ml-header-compact", compact)
      if (hero && desktop.matches && !reduced.matches) {
        const depth = Math.max(0, Math.min(18, (y / (heroTop + heroHeight)) * 18))
        hero.style.setProperty("--ml-depth", `${depth.toFixed(2)}px`)
      }
      if (desktop.matches && !document.hidden) {
        const readingY = y + window.innerHeight * .45
        const current = signalGeometry.findLastIndex(row => row.top <= readingY)
        const index = Math.max(0, current)
        if (index !== activeSignal && signalRows.length) {
          activeSignal = index
          signalRows.forEach((row, i) => row.classList.toggle("ml-signal-active", i === index))
          signals?.style.setProperty("--signal-step", String(index))
        }
        if (mainImage && !reduced.matches && y + window.innerHeight > mainTop && y < mainTop + mainHeight) {
          const progress = Math.max(0, Math.min(1, (y + window.innerHeight - mainTop) / (window.innerHeight + mainHeight)))
          mainImage.style.setProperty("--ml-main-depth", `${(-18 * progress).toFixed(2)}px`)
        }
      } else {
        signalRows.forEach(row => row.classList.remove("ml-signal-active"))
        activeSignal = -1
      }
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(updateScroll) }
    const onResize = () => { measureHero(); onScroll() }
    const discover = (node: Element) => {
      const elements = node.matches(REVEAL_SELECTOR) ? [node] : []
      elements.push(...node.querySelectorAll(REVEAL_SELECTOR))
      for (const element of elements) {
        if (seen.has(element)) continue
        seen.add(element)
        if (!reduced.matches) observer.observe(element)
      }
      if (!hero || !signals) measureHero()
    }
    discover(root)
    // App Router streaming and load-more can append markup after this island mounts.
    const additions = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element) discover(node)
      }
    })
    additions.observe(root, { childList: true, subtree: true })
    const showFocused = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return
      for (const [element, animation] of running) {
        if (element.contains(event.target)) { animation.cancel(); running.delete(element) }
      }
    }
    const stopMotion = () => {
      if (reduced.matches) {
        observer.disconnect()
        running.forEach(animation => animation.cancel())
        running.clear()
      }
      hero?.style.removeProperty("--ml-depth")
      mainImage?.style.removeProperty("--ml-main-depth")
      onScroll()
    }
    updateScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize, { passive: true })
    root.addEventListener("focusin", showFocused)
    reduced.addEventListener("change", stopMotion)
    desktop.addEventListener("change", stopMotion)
    return () => {
      observer.disconnect()
      additions.disconnect()
      running.forEach(animation => animation.cancel())
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      root.removeEventListener("focusin", showFocused)
      reduced.removeEventListener("change", stopMotion)
      desktop.removeEventListener("change", stopMotion)
      hero?.style.removeProperty("--ml-depth")
      mainImage?.style.removeProperty("--ml-main-depth")
      signalRows.forEach(row => row.classList.remove("ml-signal-active"))
      signals?.style.removeProperty("--signal-step")
    }
  }, [pathname])

  return null
}
