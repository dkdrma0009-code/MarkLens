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
  const thumbnailSrc = article?.image_url ?? ""

  if (isLarge) {
    return (
      <Link
        href={`/insights/${insight.slug}`}
        className="group relative flex flex-col bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xl transition-all duration-200"
      >
        {/* Thumbnail */}
        <div className="relative h-56 md:h-72 w-full overflow-hidden flex-shrink-0">
          <InsightThumbnail
            src={thumbnailSrc}
            alt=""
            gradient={meta.gradient}
            className="h-56 md:h-72"
          />
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {/* Category badge over image */}
          <span
            className="absolute top-4 left-4 text-[11px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap"
            style={{ backgroundColor: meta.color }}
          >
            {insight.category}
          </span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-2">
          <p className="text-xl font-bold leading-snug text-gray-900 dark:text-gray-100 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
            {headline}
          </p>
          {insight.summary && (
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
              {insight.summary}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-gray-100 dark:border-gray-800">
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
      {/* Thumbnail */}
      <div className="relative h-44 w-full overflow-hidden flex-shrink-0">
        <InsightThumbnail
          src={thumbnailSrc}
          alt=""
          gradient={meta.gradient}
          className="h-44"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <span
          className="self-start text-[11px] font-bold px-2.5 py-1 rounded-full text-white whitespace-nowrap"
          style={{ backgroundColor: meta.color }}
        >
          {insight.category}
        </span>

        <p className="font-bold text-sm leading-snug text-gray-900 dark:text-gray-100 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors line-clamp-3">
          {headline}
        </p>

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
