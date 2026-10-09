"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Menu } from "@base-ui/react/menu"
import { Ellipsis, LoaderCircle } from "lucide-react"
import ConfirmAction from "@/components/admin-v2/ConfirmAction"

type Operation = "publish" | "reject" | "delete" | "analyze" | "restore"

export default function ArticleActions({ articleId, status, hasInsight, title = "선택한 콘텐츠" }: {
  articleId: string; status: string; hasInsight?: boolean; title?: string
}) {
  const [busy, setBusy] = useState<Operation | null>(null)
  const [confirm, setConfirm] = useState<Operation | null>(null)
  const lock = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  async function run(op: Operation) {
    if (lock.current) return
    lock.current = true
    setBusy(op)
    try {
      const isStatus = op === "publish" || op === "reject" || op === "restore"
      const res = await fetch(op === "delete" ? `/api/admin/articles/${articleId}` : op === "analyze" ? "/api/articles/analyze" : `/api/articles/${articleId}/status`, {
        method: op === "delete" ? "DELETE" : isStatus ? "PATCH" : "POST",
        ...(op === "delete" ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(op === "analyze" ? { articleId } : { status: op === "publish" ? "published" : op === "reject" ? "rejected" : "pending" }) }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? "처리하지 못했습니다. 다시 시도해주세요.")
      if (op === "publish") fetch("/api/admin/quiz-bulk", { method: "POST" }).catch(() => {})
      toast.success(op === "analyze" ? "분석이 완료됐습니다." : op === "publish" ? "사이트에 공개됐습니다." : op === "reject" ? "Rejected 상태로 변경했습니다." : op === "restore" ? "Pending 상태로 복원했습니다." : "Article과 연결 Insight를 삭제했습니다.")
      setConfirm(null)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "처리 실패. 다시 시도해주세요.") }
    finally { lock.current = false; setBusy(null) }
  }
  const copy = confirm === "publish" ? { title: "사이트에 공개할까요?", description: `“${title}”을 공개합니다. 공개 후 marklens.site에서 즉시 노출될 수 있습니다. 기존 동작에 따라 퀴즈 생성도 백그라운드에서 요청됩니다.`, label: "사이트 공개" }
    : confirm === "reject" ? { title: "Rejected 상태로 변경할까요?", description: `“${title}”의 Article 상태를 rejected로 변경합니다. 공개 목록의 Published 대상에서 제외됩니다. 기존 직접 URL 접근 동작은 유지됩니다. Article과 Insight 데이터는 삭제하지 않습니다.`, label: "Reject" }
    : { title: "Article을 삭제할까요?", description: `“${title}”과 연결된 Insight를 함께 삭제합니다. 삭제를 되돌리는 복원 API는 없습니다.`, label: "Article 삭제" }
  return <div className="admin-row-actions">
    {busy ? <span className="admin-working" role="status"><LoaderCircle size={14} className="admin-spin" />{busy === "analyze" ? "분석 중…" : "처리 중…"}</span>
      : status === "pending" ? <button className="admin-control admin-primary" onClick={() => run("analyze")}>분석</button>
      : status === "ready" ? <button className="admin-control admin-primary" disabled={!hasInsight} title={!hasInsight ? "hook·summary 분석을 먼저 완료해주세요" : undefined} onClick={event => { returnFocus.current = event.currentTarget; setConfirm("publish") }}>사이트 공개</button>
      : status === "analyzing" ? <span className="admin-working" role="status">분석 상태</span>
      : status === "rejected" ? <button className="admin-control" onClick={() => run("restore")}>Pending 복원</button> : null}
    <Menu.Root><Menu.Trigger ref={menuTrigger} className="admin-icon-control" disabled={!!busy} aria-label={`${title} 추가 작업`}><Ellipsis size={18} /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner sideOffset={5} align="end" className="admin-menu-positioner"><Menu.Popup className="admin-action-menu">
        {status !== "analyzing" && status !== "pending" && status !== "rejected" && <Menu.Item onClick={() => run("analyze")}>재분석</Menu.Item>}
        {status !== "rejected" && <Menu.Item onClick={() => { returnFocus.current = menuTrigger.current; setConfirm("reject") }}>Reject 상태로 변경</Menu.Item>}
        <Menu.Item className="admin-menu-destructive" onClick={() => { returnFocus.current = menuTrigger.current; setConfirm("delete") }}>Article 삭제</Menu.Item>
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
    <ConfirmAction returnFocus={returnFocus} open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null) }} title={copy.title} description={copy.description} confirmLabel={copy.label} busy={!!busy} destructive={confirm !== "publish"} onConfirm={() => confirm && run(confirm)} />
  </div>
}
