import EditorialImage from "./EditorialImage"
import CollectionShowcase from "./CollectionShowcase"
import { selectCollections, formatDate } from "./data"

export default function Collections({ collections }: { collections: ReturnType<typeof selectCollections> }) {
  return (
    <section id="collections" className="ml-section ml-collections" aria-labelledby="collections-title" data-reveal>
      <div className="ml-container"><div className="ml-section-heading"><div><p className="ml-eyebrow">CONNECT THE DOTS</p><h2 id="collections-title">Collections<span className="ml-blue">.</span></h2></div><p>하나의 주제, 여러 개의 시선</p></div>
        {collections.length ? <CollectionShowcase
          items={collections.map(({ category, cover }) => ({ category, href: `/insights?category=${encodeURIComponent(category)}`, source: cover.article?.source_name || "MarkLens", date: formatDate(cover.created_at) }))}
          visuals={collections.map(({ cover }) => <EditorialImage key={cover.id} insight={cover} sizes="(max-width: 767px) 100vw, 60vw" />)}
        /> : <p className="ml-empty">공개 인사이트의 카테고리가 준비되면 주제별로 연결합니다.</p>}
      </div>
    </section>
  )
}
