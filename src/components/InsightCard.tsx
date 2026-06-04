import Link from "next/link"
import { getCategoryMeta } from "@/lib/category"
import InsightThumbnail from "@/components/InsightThumbnail"

interface Props {
  insight: {
    id: string
    slug: string
    hook?: string
    summary?: string
    category: string
    created_at: string
    article?: {
      title: string
      source_name: string
      image_url?: string
    }
  }
  size?: "default" | "large"
}

export default function InsightCard({ insight, size = "default" }: Props) {
  const meta = getCategoryMeta(insight.category)
  const article = insight.article
  const isLarge = size === "large"
  const headline = insight.hook || article?.title || ""

  return (
    <Link
      href={`/insights/${insight.slug}`}
      className="group flex flex-col bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className={`overflow-hidden flex-shrink-0 ${isLarge ? "h-64" : "h-48"}`}>
        {article?.image_url ? (
          <InsightThumbnail
            src={article.image_url}
            alt=""
            gradient={meta.gradient}
            className={isLarge ? "h-64" : "h-48"}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
            <span className="text-white/20 font-black select-none"
              style={{ fontSize: isLarge ? "7rem" : "5rem", lineHeight: 1 }}>
              {meta.emoji}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Category */}
        <span
          className="self-start text-[11px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap"
          style={{ backgroundColor: meta.color }}
        >
          {insight.category}
        </span>

        {/* Headline */}
        <p className={`font-bold leading-snug text-gray-900 dark:text-gray-100 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors ${isLarge ? "text-2xl" : "text-xl"}`}>
          {headline}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800 mt-auto">
          <span className="font-medium">{article?.source_name}</span>
          <span>{formatDate(insight.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
}
