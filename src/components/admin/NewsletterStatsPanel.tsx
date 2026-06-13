import type { IssueStat } from "@/lib/newsletter/stats"

export default function NewsletterStatsPanel({ stats }: { stats: IssueStat[] | null }) {
  if (stats === null) {
    return (
      <div className="mb-10 border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-lg p-5">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">뉴스레터 오픈율 추적 미설정</p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
          Supabase SQL Editor에서 실행:{" "}
          <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">create table if not exists newsletter_events (id uuid primary key default gen_random_uuid(), issue_id uuid, email text, event text, created_at timestamptz default now());</code>
          {" "}그리고 Brevo 웹훅을 등록하세요.
        </p>
      </div>
    )
  }
  if (stats.length === 0) return null

  return (
    <div className="mb-10">
      <h2 className="text-sm font-semibold mb-4">뉴스레터 성과 <span className="text-muted-foreground font-normal">(최근 발송)</span></h2>
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">이슈</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">전달</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">오픈율</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">클릭율</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.map(s => (
              <tr key={s.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <p className="font-medium line-clamp-1 text-sm">#{s.issueNumber} {s.title.replace(/^#\d+\s*[—\-–]\s*/, "")}</p>
                  {s.sentAt && <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(s.sentAt).toLocaleDateString("ko-KR")}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{s.delivered}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="font-semibold">{s.openRate}%</span>
                  <span className="text-muted-foreground text-xs ml-1">({s.opens})</span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="font-semibold">{s.clickRate}%</span>
                  <span className="text-muted-foreground text-xs ml-1">({s.clicks})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">오픈율 = 고유 오픈 / 전달. Brevo 웹훅 이벤트 기반.</p>
    </div>
  )
}
