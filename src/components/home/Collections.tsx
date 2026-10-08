import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import EditorialImage from "./EditorialImage"
import { selectCollections } from "./data"

export default function Collections({ collections }: { collections: ReturnType<typeof selectCollections> }) {
  return (
    <section id="collections" className="ml-section ml-collections" aria-labelledby="collections-title" data-reveal>
      <div className="ml-container"><div className="ml-section-heading"><div><p className="ml-eyebrow">CONNECT THE DOTS</p><h2 id="collections-title">Collections<span className="ml-blue">.</span></h2></div><p>하나의 주제, 여러 개의 시선</p></div>
        <div className="ml-collection-grid">{collections.length ? collections.map(({ category, cover }, index) => <Link key={category} href={`/insights?category=${encodeURIComponent(category)}`} className="ml-collection-cover">
          <EditorialImage key={cover.id} insight={cover} sizes="(max-width: 767px) 100vw, 33vw" />
          <div className="ml-collection-content"><span className="ml-eyebrow">COLLECTION / {String(index + 1).padStart(2, "0")}</span><h3>{category}</h3><span className="ml-collection-link">주제별 인사이트 <ArrowUpRight size={20} aria-hidden="true" /></span></div>
        </Link>) : <p className="ml-empty">공개 인사이트의 카테고리가 준비되면 주제별로 연결합니다.</p>}</div>
      </div>
    </section>
  )
}
