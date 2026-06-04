"use client"

import { useState } from "react"
import { toast } from "sonner"

export default function QuizBulkTrigger() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState("")

  async function generate() {
    setLoading(true)
    setProgress("퀴즈 일괄 생성 중...")
    try {
      const res = await fetch("/api/admin/quiz-bulk", { method: "POST" })
      const data = await res.json()
      toast.success(`퀴즈 ${data.generated}개 생성 완료`)
      setProgress("")
    } catch {
      toast.error("생성 실패")
      setProgress("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="text-sm font-medium px-4 py-2 rounded-md border border-border hover:bg-accent transition-colors disabled:opacity-50"
    >
      {loading ? progress || "생성 중..." : "퀴즈 일괄 생성"}
    </button>
  )
}
