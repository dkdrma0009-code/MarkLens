"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function AnalyzeTrigger({ pendingCount }: { pendingCount: number }) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState("")
  const router = useRouter()
  const lock = useRef(false)

  if (pendingCount === 0) return null

  async function handleAnalyzeAll() {
    if (lock.current) return
    lock.current = true
    setLoading(true)
    let total = 0
    let consecutive_errors = 0
    let hadErrors = false
    try {
      while (true) {
        setProgress(`${total}개 완료 중...`)
        const res = await fetch("/api/admin/analyze", { method: "POST" })
        const data = await res.json()
        if (!res.ok) {
          consecutive_errors++
          if (consecutive_errors >= 3) throw new Error(data.error ?? "연속 3회 분석 요청 실패")
          continue
        }
        consecutive_errors = 0
        if (data.errors?.length) hadErrors = true
        if (data.analyzed === 0) break // 더 이상 없으면 종료
        total += data.analyzed
      }
      if (hadErrors) toast.warning(`${total}개 분석 완료. 일부 분석 실패가 있어 상태를 다시 확인해주세요.`)
      else toast.success(total > 0 ? `총 ${total}개 분석 완료` : "분석할 아티클이 없습니다")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.")
      router.refresh()
    } finally {
      setLoading(false)
      setProgress("")
      lock.current = false
    }
  }

  return (
    <button
      onClick={handleAnalyzeAll}
      disabled={loading}
      className="text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
    >
      {loading ? (progress || "분석 중...") : `전체 Pending 일괄 분석 (불러온 ${pendingCount}개)`}
    </button>
  )
}
