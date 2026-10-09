"use client"
import { useRef, useState } from "react"
import { toast } from "sonner"
import ConfirmAction from "../ConfirmAction"
import SocialDialog from "./SocialDialog"
import type { SocialOperations } from "./useSocialOperations"

export default function SocialResults({ ops }: { ops: SocialOperations }) {
  const confirmFocus = useRef<HTMLElement | null>(null)
  const [confirm, setConfirm] = useState<"publish" | "download" | null>(null)
  const result = ops.shortsModal
  const diagnosis = ops.diagnoseModal
  const busy = !!(result && ops.busy.has(result.articleId))
  async function execute() {
    if (confirm === "publish") await ops.publishReels()
    else await ops.downloadShorts()
    setConfirm(null)
  }
  return <>
    <SocialDialog open={!!result} onClose={() => ops.setShortsModal(null)} title={`${result?.kind || "Reel"} 렌더 완료`} description="실제 렌더 output을 재생하고 caption을 검수한 뒤 작업을 선택하세요." returnFocus={ops.returnFocus} busy={busy}>
      {result && <><video className="social-output-video" src={result.outputFile} controls preload="metadata" aria-label="완료된 Reel 렌더" />
        <label className="social-field">게시 caption<textarea rows={4} value={result.caption} disabled={busy} onChange={event => ops.setShortsModal(previous => previous ? { ...previous, caption: event.target.value } : previous)} /></label>
        <div className="admin-confirm-buttons"><button className="admin-control" autoFocus disabled={busy} onClick={() => ops.setShortsModal(null)}>닫기</button><button className="admin-control" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(result.caption); toast.success("Caption 복사 완료") } catch { toast.error("복사 실패") } }}>Caption 복사</button><button className="admin-control" disabled={busy} onClick={event => { confirmFocus.current = event.currentTarget; setConfirm("download") }}>다운로드</button><button className="admin-control admin-primary" disabled={busy} onClick={event => { confirmFocus.current = event.currentTarget; setConfirm("publish") }}>Instagram Reel 발행</button></div></>}
    </SocialDialog>
    <ConfirmAction open={!!confirm} onOpenChange={value => { if (!value) setConfirm(null) }} returnFocus={confirmFocus} busy={busy} onConfirm={execute}
      title={confirm === "publish" ? "Instagram Reel을 게시할까요?" : "렌더 파일을 다운로드할까요?"}
      description={confirm === "publish" ? "이 렌더 파일과 caption을 Instagram Reel로 실제 게시합니다. 현재 Reel endpoint는 Threads 게시를 수행하지 않습니다. 게시 후 S3 렌더 파일 삭제도 요청됩니다." : "현재 다운로드 API는 파일을 전달한 뒤 S3 렌더 파일 삭제를 요청합니다. 이후 동일 output으로 발행하거나 다시 다운로드하지 못할 수 있습니다."}
      confirmLabel={confirm === "publish" ? "Instagram Reel 실제 발행" : "다운로드 및 S3 정리"} destructive={confirm === "download"} />
    <SocialDialog open={!!diagnosis} onClose={() => ops.setDiagnoseModal(null)} title="기존 성과 진단" description="기존 Instagram 지표·AI 진단 contract를 사용합니다. 진단 결과는 별도 발행 성공 기록이 아닙니다." returnFocus={ops.returnFocus}>
      {diagnosis?.loading ? <p role="status">분석 중…</p> : diagnosis?.error ? <p role="alert">{diagnosis.error}</p> : diagnosis && <div className="social-diagnosis">
        {diagnosis.stats && <p>도달 {diagnosis.stats.reach} · 저장 {diagnosis.stats.saved} · 좋아요 {diagnosis.stats.likes}</p>}
        {diagnosis.coverText && <p>표지: {diagnosis.coverText}</p>}<p>{diagnosis.verdict}</p>
        {diagnosis.causes?.map((cause, i) => <p key={i}>{cause}</p>)}<p>{diagnosis.fix}</p>
        {diagnosis.newHeadlines?.map((headline, i) => <div key={i}><p>{headline}</p><button className="admin-control" onClick={() => ops.applyHook(diagnosis.articleId, headline)}>표지 교체 + 기존 Reel 재렌더</button></div>)}
      </div>}
      <div className="admin-confirm-buttons"><button className="admin-control" autoFocus onClick={() => ops.setDiagnoseModal(null)}>닫기</button></div>
    </SocialDialog>
  </>
}
