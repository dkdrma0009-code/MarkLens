"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

export default function CollectionShowcase({ items, visuals }: {
  items: { category: string; href: string; source: string; date: string }[]
  visuals: ReactNode[]
}) {
  const [active, setActive] = useState(0)
  const selected = items[active]

  return <div className="ml-collection-showcase">
    <div className="ml-collection-topics">
      <p className="ml-eyebrow">EXPLORE BY PERSPECTIVE</p>
      {items.map((item, index) => <Link key={item.category} href={item.href}
        className={`ml-collection-topic${active === index ? " ml-collection-active" : ""}`}
        onClick={event => { if (event.detail > 0 && window.matchMedia("(max-width: 767px), (hover: none)").matches && !event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); setActive(index) } }}
        onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)}>
        <span className="ml-index">{String(index + 1).padStart(2, "0")}</span>
        <span>{item.category}</span><ArrowUpRight size={24} aria-hidden="true" />
      </Link>)}
      <p className="ml-collection-note">하나의 주제를 여러 시선으로.<br />흩어진 인사이트를 연결해 나만의 관점을 만드세요.</p>
    </div>
    <Link href={selected.href} className="ml-collection-visual" aria-label={`${selected.category} 인사이트 모아 보기`}>
      <div className="ml-collection-frames">{visuals.map((visual, index) => <div key={items[index].category}
        className={`ml-collection-frame${active === index ? " ml-frame-active" : ""}`} aria-hidden={active !== index}>{visual}</div>)}</div>
      <div className="ml-collection-visual-caption"><span className="ml-eyebrow">THE COLLECTION</span><span>{selected.category}</span><ArrowUpRight size={24} aria-hidden="true" /></div>
      <p className="ml-collection-meta">대표 인사이트 · {selected.source} · {selected.date} <span>모아 보기 ↗</span></p>
    </Link>
  </div>
}
