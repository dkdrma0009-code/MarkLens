"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

export default function DeleteRejectedButton({ count }: { count: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`거절된 아티클 ${count}개를 전부 삭제하시겠습니까?`)) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/articles/bulk-delete-rejected", { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.deleted}개 삭제됐습니다.`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-3 h-3" />
      {loading ? "삭제 중..." : "전체 삭제"}
    </button>
  )
}
