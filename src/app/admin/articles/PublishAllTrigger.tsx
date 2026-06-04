"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function PublishAllTrigger({ readyCount }: { readyCount: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (readyCount === 0) return null

  async function handlePublishAll() {
    if (!confirm(`준비 완료된 ${readyCount}개 아티클을 모두 발행할까요?`)) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/publish-all", { method: "POST" })
      const data = await res.json()
      toast.success(`${data.published}개 발행 완료`)
      router.refresh()
    } catch {
      toast.error("발행 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePublishAll}
      disabled={loading}
      className="text-sm font-medium px-4 py-2 rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
    >
      {loading ? "발행 중..." : `일괄 발행 (${readyCount}개)`}
    </button>
  )
}
