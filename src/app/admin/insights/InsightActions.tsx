"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import ConfirmAction from "@/components/admin-v2/ConfirmAction"
import EditInsight from "@/app/admin/articles/EditInsight"

export default function InsightActions({ insightId, title = "선택한 Insight" }: { insightId: string; title?: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const returnFocus = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  async function remove() {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      const res = await fetch(`/api/admin/insights/${insightId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "삭제 실패. 다시 시도해주세요.")
      toast.success("Insight를 삭제했습니다. 연결 Article은 Pending으로 돌아갑니다.")
      setOpen(false); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "삭제 실패") }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="admin-row-actions"><EditInsight insightId={insightId} />
    <button ref={returnFocus} className="admin-control" disabled={busy} onClick={() => setOpen(true)} aria-label={`${title} Insight 삭제`}>삭제</button>
    <ConfirmAction returnFocus={returnFocus} open={open} onOpenChange={setOpen} title="Insight를 삭제할까요?" description={`“${title}”을 삭제합니다. 현재 API 동작상 연결된 Article은 pending 상태로 돌아갑니다. 삭제를 되돌리는 복원 API는 없습니다.`} confirmLabel="Insight 삭제" busy={busy} destructive onConfirm={remove} />
  </div>
}
