import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import InsightActions from "@/app/admin/insights/InsightActions"
import { getGa4Overview } from "@/lib/ga4"
import Ga4Panel from "@/components/admin/Ga4Panel"
import { getNewsletterStats } from "@/lib/newsletter/stats"
import NewsletterStatsPanel from "@/components/admin/NewsletterStatsPanel"
import { getInstagramInsights } from "@/lib/instagram"
import InstagramPanel from "@/components/admin/InstagramPanel"
import { getThreadsInsights } from "@/lib/threads"
import ThreadsPanel from "@/components/admin/ThreadsPanel"
import FollowerChart from "@/components/admin/FollowerChart"
import SubscriberChart from "@/components/admin/SubscriberChart"

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

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 카운트 쿼리
  const [
    { count: totalArticles },
    { count: publishedArticles },
    { count: totalInsights },
    { count: totalSubscribers },
    { count: sentNewsletters },
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("insights").select("*", { count: "exact", head: true }),
    supabase.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("newsletter_issues").select("*", { count: "exact", head: true }).eq("status", "sent"),
  ])

  // 상세 데이터 쿼리
  const [
    { data: insights },
    { data: feedbacks },
    { data: igSnapshots },
    { data: threadsSnapshots },
  ] = await Promise.all([
    supabase
      .from("insights")
      .select("id, slug, hook, category, view_count, article:articles!inner(title, status)")
      .eq("articles.status", "published")
      .order("view_count", { ascending: false })
      .limit(100),
    supabase.from("feedback").select("insight_id, rating"),
    supabase.from("follower_snapshots").select("followers, recorded_at").eq("platform", "instagram").gte("recorded_at", since30).order("recorded_at"),
    supabase.from("follower_snapshots").select("followers, recorded_at").eq("platform", "threads").gte("recorded_at", since30).order("recorded_at"),
  ])

  // 외부 API + 구독자 추이
  const [
    ga4,
    newsletterStats,
    igInsights,
    threadsInsights,
    { data: newSubsRaw },
    { data: unsubsRaw },
  ] = await Promise.all([
    getGa4Overview(),
    getNewsletterStats(),
    getInstagramInsights(),
    getThreadsInsights(),
    supabase.from("subscribers").select("created_at").gte("created_at", since30),
    supabase.from("subscribers").select("unsubscribed_at").not("unsubscribed_at", "is", null).gte("unsubscribed_at", since30),
  ])

  const toChartData = (rows: { followers: number; recorded_at: string }[] | null) =>
    (rows ?? []).map(r => ({ date: r.recorded_at.slice(0, 10), followers: r.followers }))

  const groupByDay = (rows: { date: string }[]) => {
    const map: Record<string, number> = {}
    for (const r of rows) { map[r.date] = (map[r.date] ?? 0) + 1 }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
  }
  const newSubsByDay = groupByDay((newSubsRaw ?? []).map(r => ({ date: r.created_at.slice(0, 10) })))
  const unsubsByDay = groupByDay((unsubsRaw ?? []).map(r => ({ date: (r.unsubscribed_at as string).slice(0, 10) })))
  const totalNew30 = newSubsRaw?.length ?? 0
  const totalUnsub30 = unsubsRaw?.length ?? 0

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

      {/* 구독자 이탈률 */}
      <SubscriberChart
        newSubs={newSubsByDay}
        unsubs={unsubsByDay}
        totalActive={totalSubscribers ?? 0}
        totalNew30={totalNew30}
        totalUnsub30={totalUnsub30}
      />

      {/* 팔로워 추이 */}
      <FollowerChart ig={toChartData(igSnapshots)} threads={toChartData(threadsSnapshots)} />

      {/* GA4 트래픽 */}
      <Ga4Panel overview={ga4} />

      {/* 뉴스레터 성과 */}
      <NewsletterStatsPanel stats={newsletterStats} />

      {/* 인스타그램 인사이트 */}
      <InstagramPanel data={igInsights} />

      {/* 스레드 인사이트 */}
      <ThreadsPanel data={threadsInsights} />

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
