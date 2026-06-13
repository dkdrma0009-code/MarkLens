import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import InsightActions from "@/app/admin/insights/InsightActions"
import { getGa4Overview } from "@/lib/ga4"
import Ga4Panel from "@/components/admin/Ga4Panel"
import { getNewsletterStats } from "@/lib/newsletter/stats"
import NewsletterStatsPanel from "@/components/admin/NewsletterStatsPanel"

export const dynamic = 'force-dynamic'

type AnalyticsInsight = {
  id: string
  slug: string
  hook?: string | null
  category?: string | null
  view_count?: number | null
  article?: { title?: string | null; status?: string | null } | null
}

export default async function AdminAnalyticsPage() {
  const supabase = createAdminClient()

  const [
    { count: totalArticles },
    { count: publishedArticles },
    { count: totalInsights },
    { count: totalSubscribers },
    { count: sentNewsletters },
    { data: insights },
    { data: feedbacks },
    ga4,
    newsletterStats,
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("insights").select("*", { count: "exact", head: true }),
    supabase.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("newsletter_issues").select("*", { count: "exact", head: true }).eq("status", "sent"),
    supabase
      .from("insights")
      .select("id, slug, hook, category, view_count, article:articles!inner(title, status)")
      .eq("articles.status", "published")
      .order("view_count", { ascending: false })
      .limit(100),
    supabase
      .from("feedback")
      .select("insight_id, rating"),
    getGa4Overview(),
    getNewsletterStats(),
  ])

  // 인사이트별 좋아요(helpful) 수 집계
  const likeMap: Record<string, number> = {}
  for (const f of feedbacks ?? []) {
    if (f.rating === "helpful") {
      likeMap[f.insight_id] = (likeMap[f.insight_id] ?? 0) + 1
    }
  }

  const typedInsights = (insights ?? []) as AnalyticsInsight[]
  const totalViews = typedInsights.reduce((sum, i) => sum + (i.view_count ?? 0), 0)
  const totalLikes = Object.values(likeMap).reduce((sum, n) => sum + n, 0)

  const stats = [
    { label: "전체 아티클", value: totalArticles ?? 0 },
    { label: "발행된 인사이트", value: publishedArticles ?? 0 },
    { label: "전체 인사이트", value: totalInsights ?? 0 },
    { label: "전체 조회수", value: totalViews.toLocaleString() },
    { label: "전체 좋아요", value: totalLikes },
    { label: "구독자", value: totalSubscribers ?? 0 },
    { label: "발송된 뉴스레터", value: sentNewsletters ?? 0 },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">분석</h1>
        <p className="text-sm text-muted-foreground mt-1">플랫폼 운영 지표</p>
      </div>

      {/* GA4 트래픽 */}
      <Ga4Panel overview={ga4} />

      {/* 뉴스레터 성과 */}
      <NewsletterStatsPanel stats={newsletterStats} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="border border-border rounded-lg p-4 bg-background">
            <p className="text-3xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Insights Table */}
      {typedInsights.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium">인사이트 참여 지표</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">인사이트</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">카테고리</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">조회수</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">좋아요</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {typedInsights.map((insight, i) => {
                const likes = likeMap[insight.id] ?? 0
                return (
                  <tr key={insight.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/insights/${insight.slug}`}
                        className="font-medium line-clamp-1 hover:underline text-sm"
                        target="_blank"
                      >
                        {insight.hook ?? insight.article?.title ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {insight.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {(insight.view_count ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {likes > 0 ? (
                        <span className="text-rose-500 font-medium">♥ {likes}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <InsightActions insightId={insight.id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
