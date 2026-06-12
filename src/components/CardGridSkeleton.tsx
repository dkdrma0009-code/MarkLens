// 인사이트/캠페인 목록 로딩 스켈레톤 — InsightCard 그리드 레이아웃과 동일한 골격
export default function CardGridSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 w-40 rounded-lg bg-gray-100 dark:bg-gray-800 mb-3" />
        <div className="h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-gray-800" />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 mb-10 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden"
          >
            <div className="h-44 w-full bg-gray-100 dark:bg-gray-800" />
            <div className="flex flex-col p-4 gap-2">
              <div className="h-5 w-20 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
                <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-12 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
