import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = createAdminClient()

  const [
    { count: totalArticles },
    { count: pendingArticles },
    { count: publishedArticles },
    { count: totalSubscribers },
    { count: totalInsights },
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("insights").select("*", { count: "exact", head: true }),
  ])

  const stats = [
    { label: "전체 아티클", value: totalArticles ?? 0 },
    { label: "승인 대기", value: pendingArticles ?? 0, highlight: true },
    { label: "발행된 인사이트", value: publishedArticles ?? 0 },
    { label: "AI 분석 완료", value: totalInsights ?? 0 },
    { label: "뉴스레터 구독자", value: totalSubscribers ?? 0 },
  ]

  return (
    <div className="p-8">
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
          <h2 className="text-sm font-medium mb-4">빠른 실행</h2>
          <div className="space-y-2">
            <a
              href="/admin/articles"
              className="flex items-center justify-between p-3 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <span>아티클 승인/거절</span>
              {(pendingArticles ?? 0) > 0 && (
                <span className="text-xs bg-foreground text-background px-2 py-0.5 rounded-full">
                  {pendingArticles} 대기 중
                </span>
              )}
            </a>
            <a
              href="/admin/newsletter"
              className="flex items-center justify-between p-3 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              <span>뉴스레터 생성 및 발행</span>
            </a>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6 bg-background">
          <h2 className="text-sm font-medium mb-4">자동화 상태</h2>
          <div className="space-y-3">
            {[
              { label: "RSS 수집", desc: "매일 오전 9시 / 오후 6시", status: "active" },
              { label: "AI 분석", desc: "수집 후 자동 실행", status: "active" },
              { label: "뉴스레터 발송", desc: "매주 월요일 7:30 AM", status: "active" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-xs">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  운영 중
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
