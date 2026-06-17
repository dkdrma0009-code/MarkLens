import { createAdminClient } from "@/lib/supabase/admin"
import { formatDate } from "@/lib/utils"
import NewsletterControls from "./NewsletterControls"
import NewsletterPreview from "./NewsletterPreview"

export const dynamic = 'force-dynamic'

export default async function AdminNewsletterPage() {
  const supabase = createAdminClient()

  const { data: issues } = await supabase
    .from("newsletter_issues")
    .select("*")
    .order("issue_number", { ascending: false })
    .limit(20)

  const { count: subscriberCount } = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">뉴스레터 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            활성 구독자 <span className="font-medium text-foreground">{subscriberCount ?? 0}명</span>
          </p>
        </div>
        <NewsletterControls />
      </div>

      {!issues || issues.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          아직 생성된 뉴스레터가 없습니다.<br />
          위의 &quot;뉴스레터 생성&quot; 버튼을 눌러 첫 번째 호를 만들어보세요.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">호수</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">제목</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">생성일</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">발송일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    #{issue.issue_number}
                  </td>
                  <td className="px-4 py-3 font-medium">{issue.title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={issue.status} approvedAt={issue.approved_at} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(issue.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {issue.sent_at ? formatDate(issue.sent_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <NewsletterPreview issue={issue} />
                      <NewsletterControls issueId={issue.id} status={issue.status} approvedAt={issue.approved_at} />
                    </div>
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

function StatusBadge({ status, approvedAt }: { status: string; approvedAt?: string | null }) {
  if (status === "draft" && !approvedAt) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 animate-pulse">승인 대기</span>
  }
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "초안", cls: "bg-gray-100 text-gray-600" },
    ready: { label: "발송 준비", cls: "bg-emerald-100 text-emerald-700" },
    sent: { label: "발송 완료", cls: "bg-black text-white" },
  }
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
