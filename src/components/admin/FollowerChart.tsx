"use client"

interface Snapshot { date: string; followers: number }

interface Props {
  ig: Snapshot[]
  threads: Snapshot[]
}

function Sparkline({ data, color }: { data: Snapshot[]; color: string }) {
  if (data.length < 2) return null
  const W = 320, H = 80, PAD = 4
  const min = Math.min(...data.map(d => d.followers))
  const max = Math.max(...data.map(d => d.followers))
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.followers - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3" fill={color} />
    </svg>
  )
}

export default function FollowerChart({ ig, threads }: Props) {
  const latest = (data: Snapshot[]) => data[data.length - 1]?.followers?.toLocaleString() ?? "—"
  const delta = (data: Snapshot[]) => {
    if (data.length < 2) return null
    const diff = data[data.length - 1].followers - data[0].followers
    return diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()
  }

  return (
    <div className="border border-border rounded-lg p-6 bg-background mb-6">
      <h2 className="text-sm font-medium mb-4">팔로워 추이 (30일)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { label: "인스타그램", data: ig, color: "#E1306C" },
          { label: "스레드", data: threads, color: "#000000" },
        ].map(({ label, data, color }) => (
          <div key={label}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold">{latest(data)}</span>
                {delta(data) && (
                  <span className={`text-xs ${delta(data)!.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}>
                    {delta(data)}
                  </span>
                )}
              </div>
            </div>
            {data.length >= 2
              ? <Sparkline data={data} color={color} />
              : <p className="text-xs text-muted-foreground py-6 text-center">데이터가 부족합니다 (cron 실행 후 누적됩니다)</p>
            }
          </div>
        ))}
      </div>
    </div>
  )
}
