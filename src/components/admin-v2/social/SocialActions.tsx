"use client"
import { Fragment, useRef, useState } from "react"
import Link from "next/link"
import { Menu } from "@base-ui/react/menu"
import { Ellipsis } from "lucide-react"
import ConfirmAction from "../ConfirmAction"
import SocialDialog from "./SocialDialog"
import { socialDate, type CardnewsRow } from "./types"
import type { SocialOperations } from "./useSocialOperations"
import { needsReview } from "@/lib/cardnews/publish-state"

type Channel = "instagram" | "threads"
const CHANNEL_LABEL: Record<Channel, string> = { instagram: "Instagram", threads: "Threads" }

export default function SocialActions({ row, ops, studio = false, unavailable = false }: { row: CardnewsRow; ops: SocialOperations; studio?: boolean; unavailable?: boolean }) {
  const [operation, setOperation] = useState<"publish" | "posted" | "schedule" | "threads" | "release" | "record" | null>(null)
  const [channel, setChannel] = useState<Channel>("instagram")
  const [date, setDate] = useState("")
  const [postId, setPostId] = useState("")
  const returnFocus = useRef<HTMLElement | null>(null)
  const menu = useRef<HTMLButtonElement>(null)
  const busy = ops.busy.has(row.articleId)
  // Per-channel publish state (migration 023): in flight, or waiting for a person to check the platform.
  const review = { instagram: needsReview(row.igPublishState, row.igPublishClaimedAt), threads: needsReview(row.threadsPublishState, row.threadsPublishClaimedAt) }
  const igInFlight = row.igPublishState === "publishing" && !review.instagram
  const threadsRetry = !!row.postedAt && row.threadsPublishState === "failed"
  function fromMenu(value: typeof operation, target: Channel = channel) { returnFocus.current = menu.current; setChannel(target); setPostId(""); setOperation(value) }
  async function confirm() {
    const ok = operation === "publish" ? await ops.publishToInstagram(row)
      : operation === "threads" ? await ops.publishToInstagram(row, "threads")
      : operation === "release" ? await ops.resolvePublish(row, channel, "release")
      : await ops.togglePosted(row)
    if (ok) setOperation(null)
  }
  async function record() {
    if (await ops.resolvePublish(row, channel, "published", postId.trim())) setOperation(null)
  }
  async function schedule(value: string | null) {
    if (await ops.schedulePost(row, value)) setOperation(null)
  }
  const confirmCopy = operation === "publish" ? {
    title: "Instagram에 게시할까요?",
    description: `“${row.hook || row.title}” Carousel을 Instagram에 실제 게시합니다. Instagram 게시가 성공하면 Threads 교차 게시를 시도하고 결과를 따로 기록합니다. 게시 요청 중 오류가 나면 중복 게시를 막기 위해 '확인 필요'로 남깁니다.`,
    label: "Instagram 실제 발행", destructive: false,
  } : operation === "threads" ? {
    title: "Threads에 다시 게시할까요?",
    description: `이전 Threads 게시가 실패한 카드뉴스입니다. “${row.hook || row.title}” Carousel을 Threads에 실제 게시합니다.`,
    label: "Threads 실제 발행", destructive: false,
  } : operation === "release" ? {
    title: `${CHANNEL_LABEL[channel]} 재시도 가능으로 해제할까요?`,
    description: `${CHANNEL_LABEL[channel]}에서 이 게시물이 올라가지 않았음을 직접 확인한 경우에만 해제하세요. 해제하면 다시 발행할 수 있고, 실제로 게시돼 있었다면 중복 게시됩니다.`,
    label: "게시 안 됨 확인 · 해제", destructive: true,
  } : row.postedAt ? {
    title: "Posted 표시를 해제할까요?",
    description: "Instagram 게시물을 삭제하지 않습니다. MarkLens 내부 posted_at과 Instagram 발행 상태를 해제합니다. 이 변경은 향후 자동발행 대상 선정에 영향을 줄 수 있습니다. ig_post_id와 Reel 게시 기록은 이 API가 변경하지 않습니다.",
    label: "내부 Posted 표시 해제", destructive: true,
  } : {
    title: "게시 완료로 표시할까요?",
    description: "실제 Instagram 게시를 실행하지 않습니다. MarkLens 내부 posted_at을 기록하며 자동발행 대상 선정에 영향을 줄 수 있습니다.",
    label: "내부 게시 완료 표시", destructive: true,
  }
  return <div className="admin-row-actions">
    {busy ? <span role="status" className="admin-working">처리 중…</span> : !row.cardAt ? !studio && <button className="admin-control admin-primary" onClick={() => ops.generateOne(row.articleId)}>Carousel 생성</button>
      : review.instagram ? <span role="status" className="admin-working" title={row.igPublishError ?? undefined}>Instagram 확인 필요</span>
      : igInFlight ? <span role="status" className="admin-working">Instagram 발행 중</span>
      : !row.postedAt && !unavailable ? <button className="admin-control admin-primary" onClick={event => { returnFocus.current = event.currentTarget; setOperation("publish") }}>Instagram 발행</button>
      : review.threads ? <span role="status" className="admin-working" title={row.threadsPublishError ?? undefined}>Threads 확인 필요</span> : null}
    <Menu.Root><Menu.Trigger ref={menu} onClick={event => { ops.rememberFocus(event.currentTarget) }} className="admin-icon-control" disabled={busy} aria-label={`${row.hook || row.title} Social 작업`}><Ellipsis size={18} /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner sideOffset={5} align="end" className="admin-menu-positioner"><Menu.Popup className="admin-action-menu">
        {!studio && <Menu.Item render={<Link href={`/admin/cardnews/${row.articleId}`} />}>Studio 열기</Menu.Item>}
        {row.cardAt && <>
          {(["instagram", "threads"] as const).filter(c => review[c]).map(c => <Fragment key={c}>
            <Menu.Item onClick={() => fromMenu("record", c)}>{CHANNEL_LABEL[c]} 게시됨으로 기록…</Menu.Item>
            <Menu.Item onClick={() => fromMenu("release", c)}>{CHANNEL_LABEL[c]} 재시도 가능으로 해제</Menu.Item>
          </Fragment>)}
          {threadsRetry && !review.threads && !unavailable && <Menu.Item onClick={() => fromMenu("threads", "threads")}>Threads 재시도</Menu.Item>}
          {!row.postedAt && !unavailable && <Menu.Item onClick={() => { setDate(row.scheduledAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.scheduledAt)) : ""); fromMenu("schedule") }}>예약 설정 / 해제</Menu.Item>}
          <Menu.Item disabled={unavailable || review.instagram || igInFlight} onClick={() => fromMenu("posted")}>{row.postedAt ? "Posted 표시 해제" : "게시 완료 수동 표시"}</Menu.Item>
          {!studio && <Menu.Item render={<Link href={`/admin/cardnews/${row.articleId}?format=reel`} />}>Reel Studio 열기</Menu.Item>}
          <Menu.Item onClick={() => ops.generateShorts(row)}>기존 Shorts 렌더</Menu.Item>
          <Menu.Item onClick={() => ops.generateShorts(row, "ReelKineticVideo")}>기존 실사 Reel 렌더</Menu.Item>
          {row.postedAt && <Menu.Item onClick={() => ops.diagnose(row)}>성과 진단</Menu.Item>}
        </>}
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
    <ConfirmAction open={operation === "publish" || operation === "posted" || operation === "threads" || operation === "release"} onOpenChange={value => { if (!value) setOperation(null) }} returnFocus={returnFocus} busy={busy} onConfirm={confirm}
      title={confirmCopy.title} description={confirmCopy.description} confirmLabel={confirmCopy.label} destructive={confirmCopy.destructive} />
    <SocialDialog open={operation === "record"} onClose={() => setOperation(null)} title={`${CHANNEL_LABEL[channel]} 게시됨으로 기록`} description={`${CHANNEL_LABEL[channel]}에서 이 게시물이 실제로 올라간 것을 확인한 경우, 그 게시물 id를 기록합니다. 다시 게시하지 않습니다.`} returnFocus={returnFocus} busy={busy}>
      <p className="admin-note">마지막 오류: {(channel === "instagram" ? row.igPublishError : row.threadsPublishError) ?? "기록 없음 (발행 중 멈춤)"}</p>
      <label className="social-field">게시물 id<input value={postId} onChange={event => setPostId(event.target.value)} disabled={busy} /></label>
      <div className="admin-confirm-buttons"><button className="admin-control" autoFocus disabled={busy} onClick={() => setOperation(null)}>취소</button><button className="admin-control admin-primary" disabled={busy || !postId.trim()} onClick={record}>{busy ? "저장 중…" : "게시됨으로 기록"}</button></div>
    </SocialDialog>
    <SocialDialog open={operation === "schedule"} onClose={() => setOperation(null)} title="Carousel 예약" description="요청 날짜를 기존 API에 전달합니다. 실제 저장 시각은 API 응답 기준으로 표시하며 날짜 계산은 변경하지 않습니다." returnFocus={returnFocus} busy={busy}>
      <p className="admin-note">현재 저장 시각: {socialDate(row.scheduledAt)}</p>
      <label className="social-field">요청 날짜<input type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></label>
      <div className="admin-confirm-buttons"><button className="admin-control" autoFocus disabled={busy} onClick={() => setOperation(null)}>취소</button>{row.scheduledAt && <button className="admin-control" disabled={busy} onClick={() => schedule(null)}>예약 해제</button>}<button className="admin-control admin-primary" disabled={busy || !date} onClick={() => schedule(date)}>{busy ? "저장 중…" : "예약 저장"}</button></div>
    </SocialDialog>
  </div>
}
