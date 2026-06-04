"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function AnalyzeTrigger({ pendingCount }: { pendingCount: number }) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState("")
  const router = useRouter()

  if (pendingCount === 0) return null

  async function handleAnalyzeAll() {
    setLoading(true)
    let total = 0
    let consecutive_errors = 0
    try {
      while (true) {
        setProgress(`${total}개 완료 중...`)
        const res = await fetch("/api/admin/analyze", { method: "POST" })
        const data = await res.json()
        if (!res.ok) {
          consecutive_errors++
          if (consecutive_errors >= 3) break // 연속 3번 오류면 중단
          continue
        }
        consecutive_errors = 0
        if (data.analyzed === 0) break // 더 이상 없으면 종료
        total += data.analyzed
      }
      toast.success(total > 0 ? `총 ${total}개 분석 완료` : "분석할 아티클이 없습니다")
      router.refresh()
    } catch {
      toast.error("분석 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
      setProgress("")
    }
  }

  return (
    <button
      onClick={handleAnalyzeAll}
      disabled={loading}
      className="text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
    >
      {loading ? (progress || "분석 중...") : `일괄 분석 시작 (${pendingCount}개)`}
    </button>
  )
}
