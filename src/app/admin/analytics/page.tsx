import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

export default async function AdminAnalyticsPage() {
  const supabase = createAdminClient()

  const [
    { count: totalArticles },
    { count: publishedArticles },
    { count: totalInsights },
    { count: totalSubscribers },
    { count: sentNewsletters },
    { data: topInsights },
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("insights").select("*", { count: "exact", head: true }),
    supabase.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("newsletter_issues").select("*", { count: "exact", head: true }).eq("status", "sent"),
    supabase.from("insights").select("*, article:articles(title)").order("view_count", { ascending: false }).limit(5),
  ])

  const stats = [
    { label: "수집된 아티클", value: totalArticles ?? 0 },
    { label: "발행된 인사이트", value: publishedArticles ?? 0 },
    { label: "AI 분석 완료", value: totalInsights ?? 0 },
    { label: "뉴스레터 구독자", value: totalSubscribers ?? 0 },
    { label: "발송된 뉴스레터", value: sentNewsletters ?? 0 },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">분석</h1>
        <p className="text-sm text-muted-foreground mt-1">플랫폼 운영 지표</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border rounded-lg p-4 bg-background">
            <p className="text-3xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {topInsights && topInsights.length > 0 && (
        <div className="border border-border rounded-lg p-6 bg-background">
          <h2 className="text-sm font-medium mb-5">많이 읽힌 인사이트 Top 5</h2>
          <div className="space-y-3">
            {topInsights.map((insight: any, i: number) => (
              <div key={insight.id} className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground font-mono w-4">{i + 1}</span>
                <p className="flex-1 text-sm line-clamp-1">{insight.article?.title}</p>
                <span className="text-xs text-muted-foreground">{insight.view_count ?? 0} views</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
