"use client"

interface DailyData { date: string; value: number }

interface Props {
  newSubs: DailyData[]
  unsubs: DailyData[]
  totalActive: number
  totalNew30: number
  totalUnsub30: number
}

function MiniBar({ data, color }: { data: DailyData[]; color: string }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((d, i) => (
        <div
          key={i}
          title={`${d.date}: ${d.value}명`}
          style={{ height: `${(d.value / max) * 100}%`, background: color, minHeight: d.value > 0 ? 2 : 0 }}
          className="flex-1 rounded-sm opacity-80 hover:opacity-100 transition-opacity"
        />
      ))}
    </div>
  )
}

export default function SubscriberChart({ newSubs, unsubs, totalActive, totalNew30, totalUnsub30 }: Props) {
  const churnRate = totalNew30 > 0 ? ((totalUnsub30 / (totalActive + totalUnsub30)) * 100).toFixed(1) : "0"
  const net30 = totalNew30 - totalUnsub30

  return (
    <div className="border border-border rounded-lg p-6 bg-background mb-6">
      <h2 className="text-sm font-medium mb-4">구독자 이탈률 분석 (30일)</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "활성 구독자", value: totalActive.toLocaleString(), cls: "" },
          { label: "신규 구독 (30일)", value: `+${totalNew30}`, cls: "text-emerald-600" },
          { label: "구독 취소 (30일)", value: `-${totalUnsub30}`, cls: totalUnsub30 > 0 ? "text-red-500" : "" },
          { label: "순 증감", value: net30 >= 0 ? `+${net30}` : String(net30), cls: net30 >= 0 ? "text-emerald-600" : "text-red-500" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="border border-border rounded-lg p-3 bg-background">
            <p className={`text-xl font-semibold ${cls}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-muted-foreground mb-2">신규 구독 (일별)</p>
          {newSubs.length ? <MiniBar data={newSubs} color="#10b981" /> : <p className="text-xs text-muted-foreground py-4 text-center">데이터 없음</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">구독 취소 (일별)</p>
          {unsubs.length ? <MiniBar data={unsubs} color="#ef4444" /> : <p className="text-xs text-muted-foreground py-4 text-center">데이터 없음</p>}
        </div>
      </div>

      {totalUnsub30 > 0 && (
        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
          30일 이탈률: <span className="font-medium text-foreground">{churnRate}%</span>
          {Number(churnRate) > 5 && <span className="text-red-500 ml-2">⚠ 이탈률이 높습니다</span>}
        </p>
      )}
    </div>
  )
}
