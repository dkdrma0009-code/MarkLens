import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import EditorialImage from "@/components/home/EditorialImage"
import StoryMeta from "@/components/home/StoryMeta"
import { headline, type HomeInsight } from "@/components/home/data"

export default function EditorialInsight({ insight, variant = "row" }: { insight: HomeInsight; variant?: "row" | "featured" }) {
  const featured = variant === "featured"
  return <article className={`ml-editorial-insight ml-editorial-${variant}`}>
    <Link href={`/insights/${insight.slug}`} className="ml-editorial-image" aria-label={headline(insight)}>
      <EditorialImage key={insight.id} insight={insight} sizes={featured ? "(max-width: 767px) 100vw, 60vw" : "(max-width: 767px) 96px, 300px"} eager={featured} />
    </Link>
    <div className="ml-editorial-copy">
      <p className="ml-category">{insight.category}</p>
      <h2><Link href={`/insights/${insight.slug}`}>{headline(insight)}</Link></h2>
      {insight.summary ? <p className="ml-editorial-summary">{insight.summary}</p> : null}
      <StoryMeta insight={insight} />
      {featured ? <Link href={`/insights/${insight.slug}`} className="ml-text-link">인사이트 읽기 <ArrowUpRight size={18} aria-hidden="true" /></Link> : null}
    </div>
    {!featured ? <Link href={`/insights/${insight.slug}`} className="ml-editorial-arrow" aria-label={`${headline(insight)} 읽기`}><ArrowUpRight size={22} aria-hidden="true" /></Link> : null}
  </article>
}
