"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Props {
  issueId?: string
  status?: string
}

export default function NewsletterControls({ issueId, status }: Props) {
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

  // 행 내 액션 버튼
  if (status === "sent") return null
  return (
    <button
      onClick={send}
      disabled={loading}
      className="text-xs font-medium px-3 py-1 rounded bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
    >
      {loading ? "발송 중..." : "발송"}
    </button>
  )
}
