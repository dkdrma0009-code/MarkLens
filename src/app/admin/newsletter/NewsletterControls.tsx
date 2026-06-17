"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Props {
  issueId?: string
  status?: string
  approvedAt?: string | null
}

export default function NewsletterControls({ issueId, status, approvedAt }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch("/api/newsletter/generate", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`#${data.issue.issue_number} 뉴스레터가 생성됐습니다.`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패")
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    if (!issueId) return
    if (!confirm("구독자 전체에게 발송하시겠습니까?")) return
    setLoading(true)
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.sentTo}명에게 발송됐습니다.`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발송 실패")
    } finally {
      setLoading(false)
    }
  }

  // 목록 상단 "뉴스레터 생성" 버튼
  if (!issueId) {
    return (
      <button
        onClick={generate}
        disabled={loading}
        className="text-sm font-medium px-4 py-2 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
      >
        {loading ? "생성 중..." : "뉴스레터 생성"}
      </button>
    )
  }

  async function deleteIssue() {
    if (!issueId) return
    if (!confirm("이 뉴스레터를 삭제하시겠습니까?")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/newsletter/${issueId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("삭제됐습니다.")
      router.refresh()
    } catch {
      toast.error("삭제 실패")
    } finally {
      setLoading(false)
    }
  }

  // 행 내 액션 버튼
  return (
    <div className="flex items-center gap-2">
      {status !== "sent" && (
        <button
          onClick={send}
          disabled={loading}
          className={`text-xs font-medium px-3 py-1 rounded transition-colors disabled:opacity-50 ${
            !approvedAt
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-foreground text-background hover:bg-foreground/90"
          }`}
        >
          {loading ? "발송 중..." : !approvedAt ? "승인 및 발송" : "발송"}
        </button>
      )}
      <button
        onClick={deleteIssue}
        disabled={loading}
        className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
      >
        삭제
      </button>
    </div>
  )
}
