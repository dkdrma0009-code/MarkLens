"use client"
import { useRef, useState } from "react"
import Link from "next/link"
import { Menu } from "@base-ui/react/menu"
import { Ellipsis } from "lucide-react"
import ConfirmAction from "../ConfirmAction"
import SocialDialog from "./SocialDialog"
import { socialDate, type CardnewsRow } from "./types"
import type { SocialOperations } from "./useSocialOperations"

export default function SocialActions({ row, ops, studio = false, unavailable = false }: { row: CardnewsRow; ops: SocialOperations; studio?: boolean; unavailable?: boolean }) {
  const [operation, setOperation] = useState<"publish" | "posted" | "schedule" | null>(null)
  const [date, setDate] = useState("")
  const returnFocus = useRef<HTMLElement | null>(null)
  const menu = useRef<HTMLButtonElement>(null)
  const busy = ops.busy.has(row.articleId)
  function fromMenu(value: typeof operation) { returnFocus.current = menu.current; setOperation(value) }
  async function confirm() {
    const ok = operation === "publish" ? await ops.publishToInstagram(row) : await ops.togglePosted(row)
    if (ok) setOperation(null)
  }
  async function schedule(value: string | null) {
    if (await ops.schedulePost(row, value)) setOperation(null)
  }
  return <div className="admin-row-actions">
    {busy ? <span role="status" className="admin-working">처리 중…</span> : !row.cardAt ? !studio && <button className="admin-control admin-primary" onClick={() => ops.generateOne(row.articleId)}>Carousel 생성</button>
      : !row.postedAt && !unavailable ? <button className="admin-control admin-primary" onClick={event => { returnFocus.current = event.currentTarget; setOperation("publish") }}>Instagram 발행</button> : null}
    <Menu.Root><Menu.Trigger ref={menu} onClick={event => { ops.rememberFocus(event.currentTarget) }} className="admin-icon-control" disabled={busy} aria-label={`${row.hook || row.title} Social 작업`}><Ellipsis size={18} /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner sideOffset={5} align="end" className="admin-menu-positioner"><Menu.Popup className="admin-action-menu">
        {!studio && <Menu.Item render={<Link href={`/admin/cardnews/${row.articleId}`} />}>Studio 열기</Menu.Item>}
        {row.cardAt && <>
          {!row.postedAt && !unavailable && <Menu.Item onClick={() => { setDate(row.scheduledAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.scheduledAt)) : ""); fromMenu("schedule") }}>예약 설정 / 해제</Menu.Item>}
          <Menu.Item disabled={unavailable} onClick={() => fromMenu("posted")}>{row.postedAt ? "Posted 표시 해제" : "게시 완료 수동 표시"}</Menu.Item>
          {!studio && <Menu.Item render={<Link href={`/admin/cardnews/${row.articleId}?format=reel`} />}>Reel Studio 열기</Menu.Item>}
          <Menu.Item onClick={() => ops.generateShorts(row)}>기존 Shorts 렌더</Menu.Item>
          <Menu.Item onClick={() => ops.generateShorts(row, "ReelKineticVideo")}>기존 실사 Reel 렌더</Menu.Item>
          {row.postedAt && <Menu.Item onClick={() => ops.diagnose(row)}>성과 진단</Menu.Item>}
        </>}
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
    <ConfirmAction open={operation === "publish" || operation === "posted"} onOpenChange={value => { if (!value) setOperation(null) }} returnFocus={returnFocus} busy={busy} onConfirm={confirm}
      title={operation === "publish" ? "Instagram에 게시할까요?" : row.postedAt ? "Posted 표시를 해제할까요?" : "게시 완료로 표시할까요?"}
      description={operation === "publish" ? `“${row.hook || row.title}” Carousel을 Instagram에 실제 게시합니다. 현재 흐름에서는 Threads 게시도 함께 시도될 수 있습니다. Threads 결과는 별도로 확정 기록되지 않습니다.` : row.postedAt ? "Instagram 게시물을 삭제하지 않습니다. MarkLens 내부 posted_at만 해제합니다. 이 변경은 향후 자동발행 대상 선정에 영향을 줄 수 있습니다. ig_post_id와 Reel 게시 기록은 이 API가 변경하지 않습니다." : "실제 Instagram 게시를 실행하지 않습니다. MarkLens 내부 posted_at을 기록하며 자동발행 대상 선정에 영향을 줄 수 있습니다."}
      confirmLabel={operation === "publish" ? "Instagram 실제 발행" : row.postedAt ? "내부 Posted 표시 해제" : "내부 게시 완료 표시"} destructive={operation === "posted"} />
    <SocialDialog open={operation === "schedule"} onClose={() => setOperation(null)} title="Carousel 예약" description="요청 날짜를 기존 API에 전달합니다. 실제 저장 시각은 API 응답 기준으로 표시하며 날짜 계산은 변경하지 않습니다." returnFocus={returnFocus} busy={busy}>
      <p className="admin-note">현재 저장 시각: {socialDate(row.scheduledAt)}</p>
      <label className="social-field">요청 날짜<input type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></label>
      <div className="admin-confirm-buttons"><button className="admin-control" autoFocus disabled={busy} onClick={() => setOperation(null)}>취소</button>{row.scheduledAt && <button className="admin-control" disabled={busy} onClick={() => schedule(null)}>예약 해제</button>}<button className="admin-control admin-primary" disabled={busy || !date} onClick={() => schedule(date)}>{busy ? "저장 중…" : "예약 저장"}</button></div>
    </SocialDialog>
  </div>
}
