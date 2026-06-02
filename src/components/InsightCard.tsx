import Link from "next/link"
import { getCategoryMeta } from "@/lib/category"

interface Props {
  insight: {
    id: string
    slug: string
    summary?: string
    category: string
    is_featured?: boolean
    created_at: string
    article?: {
      title: string
      source_name: string
      image_url?: string
      published_at?: string
    }
  }
  size?: "default" | "large"
}

export default function InsightCard({ insight, size = "default" }: Props) {
  const meta = getCategoryMeta(insight.category)
  const article = insight.article
  const isLarge = size === "large"

  return (
    <Link
      href={`/insights/${insight.slug}`}
      className="group flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className={`relative overflow-hidden ${isLarge ? "h-52" : "h-40"}`}>
        {article?.image_url ? (
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${meta.gradient} flex items-end p-4`}>
            <span className="text-white/20 font-bold" style={{ fontSize: isLarge ? "5rem" : "3.5rem", lineHeight: 1 }}>
              {meta.emoji}
            </span>
          </div>
        )}
        {/* Category badge over thumbnail */}
        <div className="absolute top-3 left-3">
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: meta.color }}
          >
            {insight.category}
          </span>
        </div>
        {insight.is_featured && (
          <div className="absolute top-3 right-3">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black text-white">
              추천
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        <h2 className={`font-semibold leading-snug mb-2 group-hover:text-gray-600 transition-colors line-clamp-2 ${isLarge ? "text-lg" : "text-base"}`}>
          {article?.title}
        </h2>
        {insight.summary && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4 flex-1">
            {insight.summary}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
          <span className="font-medium">{article?.source_name}</span>
          <span>{formatDate(insight.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
}
