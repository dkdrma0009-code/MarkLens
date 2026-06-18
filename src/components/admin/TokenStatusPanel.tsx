"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

interface TokenStatus {
  ig: { daysLeft: number | null; lastRefreshed: string | null }
  threads: { daysLeft: number | null; lastRefreshed: string | null }
}

function Badge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">갱신 이력 없음</span>
  if (days <= 7) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">D-{days} 위험</span>
  if (days <= 14) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">D-{days} 주의</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">D-{days} 정상</span>
}

export default function TokenStatusPanel() {
  const [status, setStatus] = useState<TokenStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const res = await fetch("/api/admin/tokens").catch(() => null)
    if (res?.ok) setStatus(await res.json())
  }

  useEffect(() => {
    fetch("/api/admin/tokens")
      .then(res => res.ok ? res.json() : null)
      .catch(() => null)
      .then((data: TokenStatus | null) => { if (data) setStatus(data) })
  }, [])

  async function handleRefresh(platform: "ig" | "threads" | "both") {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      })
      const data = await res.json()
      if (data.igError || data.threadsError) {
        toast.error(data.igError ?? data.threadsError)
      } else {
        toast.success("토큰 갱신 완료")
        await load()
      }
    } finally {
      setRefreshing(false)
    }
  }

  const warn = status && (
    (status.ig.daysLeft === null || status.ig.daysLeft <= 14) ||
    (status.threads.daysLeft === null || status.threads.daysLeft <= 14)
  )

  return (
    <div className={`border rounded-lg p-6 bg-background ${warn ? "border-yellow-400 dark:border-yellow-600" : "border-border"}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">API 토큰 만료 현황</h2>
        <button
          onClick={() => handleRefresh("both")}
          disabled={refreshing}
          className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {refreshing ? "갱신 중..." : "전체 갱신"}
        </button>
      </div>

      <div className="space-y-3">
        {[
          { label: "인스타그램", key: "ig" as const },
          { label: "스레드", key: "threads" as const },
        ].map(({ label, key }) => {
          const s = status?.[key]
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex items-center gap-2">
                {s ? <Badge days={s.daysLeft} /> : <span className="text-xs text-muted-foreground">로딩 중...</span>}
                <button
                  onClick={() => handleRefresh(key)}
                  disabled={refreshing}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  갱신
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {warn && (
        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
          ⚠ 만료 임박 토큰이 있습니다. 지금 갱신하세요.
        </p>
      )}
    </div>
  )
}
