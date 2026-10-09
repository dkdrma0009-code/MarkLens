"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import ConfirmAction from "./ConfirmAction"

export default function BulkAction({ operation, loadedCount }: { operation: "publish" | "delete"; loadedCount: number }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const returnFocus = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const publish = operation === "publish"
  async function execute() {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      const res = await fetch(publish ? "/api/admin/publish-all" : "/api/admin/articles/bulk-delete-rejected", { method: publish ? "POST" : "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "처리 실패. 다시 시도해주세요.")
      toast.success(`${publish ? data.published : data.deleted}개 ${publish ? "발행" : "삭제"} 완료`)
      setOpen(false); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "처리 실패") }
    finally { lock.current = false; setBusy(false) }
  }
  return <><button ref={returnFocus} className="admin-control" disabled={busy} onClick={() => setOpen(true)} title={`현재 불러온 ${publish ? "Ready" : "Rejected"}: ${loadedCount}건. 실행 범위는 전체 DB입니다.`}>{publish ? "모든 Ready 콘텐츠 발행" : "모든 Rejected 삭제"}</button>
    <ConfirmAction returnFocus={returnFocus} open={open} onOpenChange={setOpen} busy={busy} destructive={!publish} onConfirm={execute}
      title={publish ? "전체 Ready 콘텐츠를 발행할까요?" : "전체 Rejected 콘텐츠를 삭제할까요?"}
      description={publish ? "현재 화면·필터·조회 제한과 무관하게 전체 Ready 중 hook·summary가 있는 콘텐츠가 대상입니다. 사이트 공개 후 즉시 노출될 수 있습니다." : "현재 화면·필터·조회 제한과 무관하게 전체 Rejected Article과 연결 Insight를 삭제합니다. 삭제를 되돌리는 복원 API는 없습니다."}
      confirmLabel={publish ? "전체 대상 사이트 공개" : "전체 Rejected 삭제"} />
  </>
}
