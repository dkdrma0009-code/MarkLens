"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import EditInsight from "@/app/admin/articles/EditInsight"

interface Props {
  insightId: string
}

export default function InsightActions({ insightId }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm("이 인사이트를 삭제하시겠습니까?\n연결된 아티클은 '준비 완료' 상태로 복귀됩니다.")) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/insights/${insightId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("삭제됐습니다.")
      router.refresh()
    } catch {
      toast.error("삭제 실패")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <EditInsight insightId={insightId} />
      <button
        onClick={handleDelete}
        disabled={loading}
        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        title="삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
