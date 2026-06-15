import type { ThreadsInsights } from "@/lib/threads"

export default function ThreadsPanel({ data }: { data: ThreadsInsights | null }) {
  if (!data) {
    return (
      <div className="mb-8 border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-lg p-5">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">스레드 인사이트 미연동</p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
          THREADS_ACCESS_TOKEN·THREADS_USER_ID 확인이 필요하거나 토큰이 만료됐을 수 있습니다.
        </p>
      </div>
    )
  }

  const { account, media, totalViews } = data
  const cards = [
    { label: "팔로워", value: account.followers },
    { label: "게시물", value: media.length },
    { label: "최근 조회(합)", value: totalViews },
  ]

  return (
    <div className="mb-10 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          스레드 <span className="text-muted-foreground font-normal">@{account.username}</span>
        </h2>
        <a href={`https://www.threads.com/@${account.username}`} target="_blank" rel="noopener"
          className="text-xs text-muted-foreground hover:text-foreground">프로필 →</a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="border border-border rounded-lg p-4 bg-background">
            <p className="text-3xl font-semibold tabular-nums">{c.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {media.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-medium">게시물별 성과</h3></div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">게시물</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">조회</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">좋아요</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">답글</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">리포스트</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">인용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {media.map(m => (
                <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 max-w-xs">
                    <a href={m.permalink} target="_blank" rel="noopener" className="line-clamp-1 hover:underline">
                      {m.text || "(텍스트 없음)"}
                    </a>
                    <span className="text-[11px] text-muted-foreground">{m.timestamp?.slice(0, 10)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.views.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.likes}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.replies}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.reposts}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.quotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
