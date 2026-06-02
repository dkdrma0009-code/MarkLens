"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Props {
  articleId: string
  status: string
}

export default function ArticleActions({ articleId, status }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function updateStatus(newStatus: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/articles/${articleId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success(
        newStatus === "published" ? "발행됐습니다." : newStatus === "rejected" ? "거절됐습니다." : "업데이트됐습니다."
      )
      router.refresh()
    } catch {
      toast.error("오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  async function analyzeOne() {
    setLoading(true)
    try {
      const res = await fetch("/api/articles/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "분석 실패")
      toast.success("분석 완료됐습니다.")
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? "오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  if (status === "published") return null
  if (status === "rejected") return (
    <button
      onClick={() => updateStatus("pending")}
      disabled={loading}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      복원
    </button>
  )

  return (
    <div className="flex items-center gap-2">
      {status === "ready" && (
        <button
          onClick={() => updateStatus("published")}
          disabled={loading}
          className="text-xs font-medium px-3 py-1 rounded bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          발행
        </button>
      )}
      {status === "pending" && (
        <button
          onClick={analyzeOne}
          disabled={loading}
          className="text-xs font-medium px-3 py-1 rounded border border-border hover:bg-accent transition-colors disabled:opacity-50"
        >
          {loading ? "분석 중..." : "분석"}
        </button>
      )}
      <button
        onClick={() => updateStatus("rejected")}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
      >
        거절
      </button>
    </div>
  )
}
