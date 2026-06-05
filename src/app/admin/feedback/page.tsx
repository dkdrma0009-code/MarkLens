import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function AdminFeedbackPage() {
  const supabase = createAdminClient()
  const { data: responses } = await supabase
    .from("site_feedback")
    .select("*")
    .order("created_at", { ascending: false })

  const total = responses?.length ?? 0
  const avg = total > 0
    ? (responses!.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    : "—"

  const subscribeYes = responses?.filter(r => r.will_subscribe === "yes").length ?? 0
  const subscribeMaybe = responses?.filter(r => r.will_subscribe === "maybe").length ?? 0

  const STARS = ["", "별로예요", "아쉬워요", "괜찮아요", "좋아요", "최고예요"]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">피드백</h1>
        <p className="text-sm text-muted-foreground mt-1">사이트 피드백 응답 목록</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-border rounded-lg p-4 bg-background">
          <p className="text-3xl font-semibold">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">전체 응답</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-background">
          <p className="text-3xl font-semibold">⭐ {avg}</p>
          <p className="text-xs text-muted-foreground mt-1">평균 별점</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-background">
          <p className="text-3xl font-semibold">{subscribeYes + subscribeMaybe}</p>
          <p className="text-xs text-muted-foreground mt-1">구독 의향 (확정+고민)</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          아직 피드백이 없습니다. <span className="font-medium">/feedback</span> 링크를 공유해보세요.
        </div>
      ) : (
        <div className="space-y-4">
          {responses!.map((r) => (
            <div key={r.id} className="border border-border rounded-lg p-5 bg-background space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{"⭐".repeat(r.rating)}</span>
                  <span className="text-sm font-medium text-muted-foreground">{STARS[r.rating]}</span>
                  {r.role && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {r.role}
                    </span>
                  )}
                  {r.will_subscribe && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.will_subscribe === "yes"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.will_subscribe === "maybe"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {r.will_subscribe === "yes" ? "구독 의향 ✓" : r.will_subscribe === "maybe" ? "고민 중" : "구독 안 함"}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {r.liked && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">좋았던 점</p>
                  <p className="text-sm text-foreground">{r.liked}</p>
                </div>
              )}
              {r.disliked && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">아쉬운 점</p>
                  <p className="text-sm text-foreground">{r.disliked}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
