"use client"

import { useEffect, useState, useCallback } from "react"

type Check = { ok: boolean; detail: string }
type HealthResp = { ok: boolean; checkedAt: string; checks: Record<string, Check> }

const LABELS: Record<string, string> = {
  supabase: "Supabase DB",
  brevo: "Brevo 메일",
  instagram: "Instagram",
  threads: "Threads",
  ga4: "GA4 분석",
  env: "환경변수",
}

export default function HealthPanel() {
  const [data, setData] = useState<HealthResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/health")
      const j = (await res.json()) as HealthResp
      setData(j)
    } catch {
      setError("헬스체크 호출 실패")
    } finally {
      setLoading(false)
    }
  }, [])

  // 마운트 시 1회 로드 — setState는 await 이후에만 호출 (effect 동기 setState 회피)
  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/health")
      .then(res => res.json())
      .then((j: HealthResp) => { if (!cancelled) setData(j) })
      .catch(() => { if (!cancelled) setError("헬스체크 호출 실패") })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="border border-border rounded-lg p-6 bg-background">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">연동 상태 (실시간)</h2>
        <button
          onClick={run}
          disabled={loading}
          className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          {loading ? "확인 중..." : "다시 확인"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {data && (
        <div className="space-y-2.5">
          {Object.entries(data.checks).map(([key, c]) => (
            <div key={key} className="flex items-center justify-between text-sm gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="font-medium text-xs flex-shrink-0">{LABELS[key] ?? key}</span>
                <span className="text-xs text-muted-foreground truncate">{c.detail}</span>
              </div>
              <span className={`text-xs flex-shrink-0 ${c.ok ? "text-emerald-600" : "text-red-600 font-medium"}`}>
                {c.ok ? "정상" : "실패"}
              </span>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground pt-1">
            확인 시각: {new Date(data.checkedAt).toLocaleString("ko-KR")}
          </p>
        </div>
      )}

      {!data && !error && <p className="text-xs text-muted-foreground">확인 중...</p>}
    </div>
  )
}
