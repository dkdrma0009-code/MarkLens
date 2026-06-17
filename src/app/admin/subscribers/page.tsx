import { createAdminClient } from "@/lib/supabase/admin"
import SubscriberExport from "./SubscriberExport"

export const dynamic = "force-dynamic"

export default async function AdminSubscribersPage() {
  const supabase = createAdminClient()

  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("*")
    .order("subscribed_at", { ascending: false })

  const active = subscribers?.filter(s => s.status === "active").length ?? 0
  const pending = subscribers?.filter(s => s.status === "pending").length ?? 0
  const unsubscribed = subscribers?.filter(s => s.status === "unsubscribed").length ?? 0

  // 유입 경로 분포
  const sourceMap: Record<string, number> = {}
  for (const s of subscribers ?? []) {
    const key = (s.source as string | null) ?? "직접"
    sourceMap[key] = (sourceMap[key] ?? 0) + 1
  }
  const sourceEntries = Object.entries(sourceMap).sort(([, a], [, b]) => b - a)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">구독자 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            활성 <span className="font-medium text-foreground">{active}명</span>
            {pending > 0 && <> · 인증 대기 <span className="font-medium text-amber-600">{pending}명</span></>}
            {unsubscribed > 0 && <> · 취소 <span className="font-medium">{unsubscribed}명</span></>}
          </p>
        </div>
        {subscribers && subscribers.length > 0 && (
          <SubscriberExport subscribers={subscribers} />
        )}
      </div>

      {/* 유입 경로 분포 */}
      {sourceEntries.length > 0 && (
        <div className="border border-border rounded-lg p-5 bg-background mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-3">유입 경로</p>
          <div className="flex flex-wrap gap-2">
            {sourceEntries.map(([src, cnt]) => (
              <span key={src} className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/30">
                {src} <span className="font-semibold text-foreground">{cnt}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "활성 구독자", value: active, color: "text-emerald-600" },
          { label: "인증 대기", value: pending, color: "text-amber-600" },
          { label: "구독 취소", value: unsubscribed, color: "text-muted-foreground" },
        ].map((stat) => (
          <div key={stat.label} className="border border-border rounded-lg p-5 bg-background">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {!subscribers || subscribers.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          아직 구독자가 없습니다.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">이메일</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">유입 경로</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">구독일</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">취소일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{sub.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {(sub.source as string | null) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(sub.subscribed_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {sub.unsubscribed_at ? new Date(sub.unsubscribed_at).toLocaleDateString("ko-KR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "활성", cls: "bg-emerald-100 text-emerald-700" },
    pending: { label: "인증 대기", cls: "bg-amber-100 text-amber-700" },
    unsubscribed: { label: "취소", cls: "bg-gray-100 text-gray-500" },
  }
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
