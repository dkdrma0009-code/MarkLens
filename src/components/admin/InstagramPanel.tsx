import type { IgInsights } from "@/lib/instagram"

export default function InstagramPanel({ data }: { data: IgInsights | null }) {
  if (!data) {
    return (
      <div className="mb-8 border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-lg p-5">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">인스타그램 인사이트 미연동</p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
          IG_ACCESS_TOKEN·IG_USER_ID 확인이 필요하거나, 토큰이 만료됐을 수 있습니다.
        </p>
      </div>
    )
  }

  const { account, dailyReach, media } = data
  const maxReach = Math.max(1, ...dailyReach.map(d => d.reach))
  const cards = [
    { label: "팔로워", value: account.followers },
    { label: "게시물", value: account.mediaCount },
    { label: "최근 도달(합)", value: dailyReach.reduce((s, d) => s + d.reach, 0) },
  ]

  return (
    <div className="mb-10 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          인스타그램 <span className="text-muted-foreground font-normal">@{account.username}</span>
        </h2>
        <a href={`https://instagram.com/${account.username}`} target="_blank" rel="noopener"
          className="text-xs text-muted-foreground hover:text-foreground">프로필 →</a>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="border border-border rounded-lg p-4 bg-background">
            <p className="text-3xl font-semibold tabular-nums">{c.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 일별 도달 막대 */}
      {dailyReach.length > 0 && (
        <div className="border border-border rounded-lg p-4 bg-background">
          <p className="text-xs text-muted-foreground mb-3">일별 도달 (최근 {dailyReach.length}일)</p>
          <div className="flex items-end gap-1.5 h-24">
            {dailyReach.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-muted-foreground tabular-nums">{d.reach}</span>
                <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${(d.reach / maxReach) * 100}%` }} />
                <span className="text-[9px] text-muted-foreground">{d.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 게시물별 성과 */}
      {media.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="px-5 py-3 border-b border-border"><h3 className="text-sm font-medium">게시물별 성과</h3></div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">게시물</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">도달</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">좋아요</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">저장</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">공유</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">댓글</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {media.map(m => (
                <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 max-w-xs">
                    <a href={m.permalink} target="_blank" rel="noopener" className="line-clamp-1 hover:underline">
                      {m.caption || "(캡션 없음)"}
                    </a>
                    <span className="text-[11px] text-muted-foreground">{m.timestamp?.slice(0, 10)} · {m.mediaType}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.reach.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.likes}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.saved}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.shares}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
