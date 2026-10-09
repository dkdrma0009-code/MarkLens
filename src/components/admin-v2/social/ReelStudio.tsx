"use client"
import dynamic from "next/dynamic"
import type { SocialOperations } from "./useSocialOperations"
import type { CardnewsRow } from "./types"

const ReelPreview = dynamic(() => import("@/components/admin/ReelPreview"), { ssr: false, loading: () => <p role="status">Reel Player를 불러오는 중…</p> })

export default function ReelStudio({ row, ops }: { row: CardnewsRow; ops: SocialOperations }) {
  const preview = ops.reelPreview
  const busy = ops.busy.has(row.articleId)
  return <section className="social-reel-studio" aria-label="Reel Studio">
    <div className="social-studio-toolbar"><button className="admin-control admin-primary" disabled={busy || !row.cardAt} onClick={event => { ops.rememberFocus(event.currentTarget); ops.openReelPreview(row) }}>{busy ? "처리 중…" : preview ? "저장된 데이터 다시 불러오기" : "Reel Preview 불러오기"}</button>
      {preview && <><button className="admin-control" disabled={busy} onClick={ops.saveReelSettings}>사진·설정 저장</button><button className="admin-control admin-primary" disabled={busy} onClick={event => { ops.rememberFocus(event.currentTarget); ops.generateShorts(row, "Reel", preview.settings, preview.photos) }}>이 설정으로 Reel 렌더</button>{preview.fromSaved && <button className="admin-control" disabled={busy} onClick={() => ops.resetReelSettings(row.articleId)}>저장 초기화 / AI 재판단</button>}</>}
    </div>
    <p className="admin-note">기존 Reel composition · 1080 × 1920. Player의 settings·photos를 동일한 렌더 요청에 전달합니다. Preview 조회는 저장된 설정이 없을 때 기존 사진·vision 처리를 호출할 수 있습니다.</p>
    {!preview ? <div className="admin-empty" role="status">{busy ? "Slides·사진·설정을 불러오는 중…" : "Reel Preview를 불러와 장면과 실제 연출을 검수하세요. 새 Shorts format은 추가하지 않습니다."}</div> : <>
      <p className="social-reel-origin">{preview.fromSaved ? "저장된 사진·설정" : "기존 resolver의 사진·연출"} · {Object.keys(preview.photos).length}개 장면 photo 기록</p>
      <fieldset disabled={busy} className="social-reel-fields"><legend className="sr-only">Reel 장면과 연출 설정</legend><ReelPreview slides={preview.slides} category={preview.category} coverImage={preview.coverImage} photos={preview.photos} settings={preview.settings} onChange={settings => ops.setReelPreview(previous => previous ? { ...previous, settings } : previous)} /></fieldset>
    </>}
  </section>
}
