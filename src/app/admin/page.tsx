import { createAdminClient } from "@/lib/supabase/admin"
import HealthPanel from "@/components/admin/HealthPanel"
import TokenStatusPanel from "@/components/admin/TokenStatusPanel"

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = createAdminClient()
  const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

  const [
    { count: totalArticles },
    { count: pendingArticles },
    { count: publishedArticles },
    { count: totalSubscribers },
    { count: totalInsights },
    { data: pendingNewsletter },
    { data: todayScheduled },
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("insights").select("*", { count: "exact", head: true }),
    // 승인 대기 뉴스레터 (draft + approved_at 없음)
    supabase.from("newsletter_issues").select("id, issue_number, title").eq("status", "draft").is("approved_at", null).limit(1),
    // 오늘 예약 발행 예정인 카드뉴스
    supabase.from("cardnews").select("id, article_id, scheduled_at").not("scheduled_at", "is", null).is("posted_at", null).lte("scheduled_at", `${todayKst}T23:59:59Z`).limit(5),
  ])

  const stats = [
    { label: "전체 아티클", value: totalArticles ?? 0 },
    { label: "승인 대기", value: pendingArticles ?? 0, highlight: true },
    { label: "발행된 인사이트", value: publishedArticles ?? 0 },
    { label: "AI 분석 완료", value: totalInsights ?? 0 },
    { label: "뉴스레터 구독자", value: totalSubscribers ?? 0 },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">MarkLens 운영 현황</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`border rounded-lg p-4 ${stat.highlight ? "border-foreground/30 bg-foreground/5" : "border-border bg-background"}`}
          >
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-border rounded-lg p-6 bg-background">
          <h2 className="text-sm font-medium mb-4">오늘 할 일</h2>
          <div className="space-y-2">
            <a href="/admin/articles" className="flex items-center justify-between p-3 text-sm border border-border rounded-md hover:bg-accent transition-colors">
              <span>아티클 승인/거절</span>
              {(pendingArticles ?? 0) > 0
                ? <span className="text-xs bg-foreground text-background px-2 py-0.5 rounded-full">{pendingArticles} 대기</span>
                : <span className="text-xs text-muted-foreground">없음</span>}
            </a>
            <a href="/admin/newsletter" className="flex items-center justify-between p-3 text-sm border border-border rounded-md hover:bg-accent transition-colors">
              <span>뉴스레터 승인 및 발송</span>
              {pendingNewsletter?.length
                ? <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">#{pendingNewsletter[0].issue_number} 대기</span>
                : <span className="text-xs text-muted-foreground">없음</span>}
            </a>
            <a href="/admin/cardnews" className="flex items-center justify-between p-3 text-sm border border-border rounded-md hover:bg-accent transition-colors">
              <span>오늘 예약 발행 카드뉴스</span>
              {(todayScheduled?.length ?? 0) > 0
                ? <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">{todayScheduled!.length}건</span>
                : <span className="text-xs text-muted-foreground">없음</span>}
            </a>
            <a href="/admin/analytics" className="flex items-center justify-between p-3 text-sm border border-border rounded-md hover:bg-accent transition-colors">
              <span>분석 대시보드</span>
            </a>
          </div>
        </div>

        <HealthPanel />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <TokenStatusPanel />
      </div>
    </div>
  )
}
