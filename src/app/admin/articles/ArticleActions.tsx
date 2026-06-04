"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

interface Props {
  articleId: string
  status: string
  hasInsight?: boolean
}

export default function ArticleActions({ articleId, status, hasInsight }: Props) {
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
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "오류")
      }
      // 발행 시 퀴즈 자동 생성 (백그라운드, 실패해도 무방)
      if (newStatus === "published") {
        fetch("/api/admin/quiz-bulk", { method: "POST" }).catch(() => {})
      }
      toast.success(newStatus === "published" ? "발행됐습니다." : newStatus === "rejected" ? "거절됐습니다." : "업데이트됐습니다.")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류가 발생했습니다.")
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  async function deleteArticle() {
    if (!confirm("이 아티클을 삭제하시겠습니까? 연결된 인사이트도 함께 삭제됩니다.")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/articles/${articleId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("삭제됐습니다.")
      router.refresh()
    } catch {
      toast.error("삭제 실패")
    } finally {
      setLoading(false)
    }
  }

  if (status === "rejected") return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => updateStatus("pending")}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        복원
      </button>
      <button
        onClick={deleteArticle}
        disabled={loading}
        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        title="삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  return (
    <div className="flex items-center gap-2">
      {status === "ready" && (
        <button
          onClick={() => hasInsight
            ? updateStatus("published")
            : toast.error("인사이트 분석을 먼저 완료해주세요.")
          }
          disabled={loading}
          title={hasInsight ? "발행" : "인사이트 없음 — 분석 후 발행 가능"}
          className={`text-xs font-medium px-3 py-1 rounded transition-colors whitespace-nowrap ${
            hasInsight
              ? "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {hasInsight ? "발행" : "발행 불가"}
        </button>
      )}
      {status === "pending" && (
        <button
          onClick={analyzeOne}
          disabled={loading}
          className="text-xs font-medium px-3 py-1 rounded border border-border hover:bg-accent transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "분석 중..." : "분석"}
        </button>
      )}
      {status === "analyzing" && (
        <span className="text-xs text-muted-foreground">분석 중...</span>
      )}
      <button
        onClick={() => updateStatus("rejected")}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        거절
      </button>
      <button
        onClick={deleteArticle}
        disabled={loading}
        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        title="삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
