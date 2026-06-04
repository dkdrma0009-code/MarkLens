import Link from "next/link"
import { getCategoryMeta } from "@/lib/category"

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

  if (isLarge) {
    return (
      <Link
        href={`/insights/${insight.slug}`}
        className="group flex flex-col md:flex-row bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all duration-200"
      >
        {/* Gradient block */}
        <div
          className={`w-full md:w-64 lg:w-80 flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${meta.gradient} min-h-48 md:min-h-full`}
        >
          <span className="text-white/20 font-black select-none" style={{ fontSize: "6rem", lineHeight: 1 }}>
            {meta.emoji}
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-7 gap-4 justify-between">
          <div className="space-y-3">
            <span
              className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap"
              style={{ backgroundColor: meta.color }}
            >
              {insight.category}
            </span>
            <p className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
              {headline}
            </p>
            {insight.summary && (
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                {insight.summary}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-800">
            <span className="font-medium">{article?.source_name}</span>
            <span>{formatDate(insight.created_at)}</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/insights/${insight.slug}`}
      className="group flex flex-col bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all duration-200"
    >
      {/* Gradient accent */}
      <div className={`h-2 w-full bg-gradient-to-r ${meta.gradient}`} />

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <span
          className="self-start text-[11px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap"
          style={{ backgroundColor: meta.color }}
        >
          {insight.category}
        </span>

        <p className="font-bold text-base leading-snug text-gray-900 dark:text-gray-100 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors line-clamp-3">
          {headline}
        </p>

        {insight.summary && (
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-2">
            {insight.summary}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-100 dark:border-gray-800 mt-auto">
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
