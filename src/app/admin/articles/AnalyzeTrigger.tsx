"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function AnalyzeTrigger({ pendingCount }: { pendingCount: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (pendingCount === 0) return null

  async function handleAnalyze() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/analyze", { method: "POST" })
      const data = await res.json()
      if (data.analyzed > 0) {
        toast.success(`${data.analyzed}개 분석 완료`)
        router.refresh()
      } else if (data.message) {
        toast.info(data.message)
      } else {
        toast.error("분석 실패: " + (data.errors?.[0] ?? "알 수 없는 오류"))
      }
    } catch {
      toast.error("분석 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAnalyze}
      disabled={loading}
      className="text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
    >
      {loading ? "분석 중..." : `AI 분석 시작 (${pendingCount}개 대기)`}
    </button>
  )
}
