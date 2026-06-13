import type { Ga4Overview } from "@/lib/ga4"

function fmtDate(d: string): string {
  // "YYYYMMDD" → "M/D"
  if (d?.length === 8) return `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`
  return d
}

export default function Ga4Panel({ overview }: { overview: Ga4Overview | null }) {
  if (!overview) {
    return (
      <div className="mb-8 border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 rounded-lg p-5">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">GA4 미연동</p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
          방문자·유입 소스·인기 페이지를 보려면 환경변수 <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">GA4_PROPERTY_ID</code>,
          {" "}<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">GA4_SA_CLIENT_EMAIL</code>,
          {" "}<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">GA4_SA_PRIVATE_KEY</code>를 설정하세요.
        </p>
      </div>
    )
  }

  const { summary, daily, sources, pages, devices } = overview
  const maxUsers = Math.max(1, ...daily.map(d => d.users))
  const cards = [
    { label: "방문자 (28일)", value: summary.activeUsers },
    { label: "세션", value: summary.sessions },
    { label: "페이지뷰", value: summary.pageViews },
    { label: "신규 방문자", value: summary.newUsers },
  ]

  return (
    <div className="mb-10 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">트래픽 · 최근 28일 <span className="text-muted-foreground font-normal">(GA4)</span></h2>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="border border-border rounded-lg p-4 bg-background">
            <p className="text-3xl font-semibold tabular-nums">{c.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* 일별 방문자 추이 */}
      {daily.length > 0 && (
        <div className="border border-border rounded-lg p-5 bg-background">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">일별 방문자</p>
            <p className="text-[11px] text-muted-foreground">최대 <span className="font-semibold text-foreground tabular-nums">{maxUsers}</span>명</p>
          </div>
          {/* 컬럼 div에 h-full을 줘야 자식 막대의 %height가 정상 계산됨 */}
          <div className="flex items-end gap-[2px] h-32">
            {daily.map(d => (
              <div key={d.date} className="flex-1 h-full flex flex-col justify-end group" title={`${fmtDate(d.date)} · ${d.users}명`}>
                <div className="w-full rounded-t bg-indigo-500/85 group-hover:bg-indigo-500 transition-colors min-h-[3px]"
                  style={{ height: `${Math.max(3, (d.users / maxUsers) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>{fmtDate(daily[0]?.date)}</span>
            <span>{fmtDate(daily[daily.length - 1]?.date)}</span>
          </div>
        </div>
      )}

      {/* 유입 소스 + 인기 페이지 */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="px-4 py-3 border-b border-border"><p className="text-xs font-medium">유입 소스</p></div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {sources.map(s => {
                const isIg = /instagram|bio/i.test(s.source)
                return (
                  <tr key={s.source} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span className={isIg ? "font-semibold text-rose-500" : ""}>{s.source || "(직접)"}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.sessions.toLocaleString()}</td>
                  </tr>
                )
              })}
              {sources.length === 0 && <tr><td className="px-4 py-3 text-xs text-muted-foreground">데이터 없음</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="px-4 py-3 border-b border-border"><p className="text-xs font-medium">인기 페이지</p></div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {pages.map(p => (
                <tr key={p.path} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 max-w-[1px]"><p className="truncate text-xs">{p.path}</p></td>
                  <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{p.views.toLocaleString()}</td>
                </tr>
              ))}
              {pages.length === 0 && <tr><td className="px-4 py-3 text-xs text-muted-foreground">데이터 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 디바이스 */}
      {devices.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {devices.map(d => (
            <div key={d.device} className="border border-border rounded-lg px-4 py-2.5 bg-background text-sm">
              <span className="text-muted-foreground capitalize">{d.device}</span>
              <span className="ml-2 font-semibold tabular-nums">{d.sessions.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
