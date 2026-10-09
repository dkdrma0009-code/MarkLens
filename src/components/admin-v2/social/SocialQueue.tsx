"use client"
import { useRef, useState } from "react"
import Link from "next/link"
import useSocialOperations from "./useSocialOperations"
import SocialActions from "./SocialActions"
import SocialPreview from "./SocialPreview"
import SocialResults from "./SocialResults"
import SocialDialog from "./SocialDialog"
import RenderImage from "./RenderImage"
import { rowStatus, socialDate, type CardnewsRow, type CurationRow } from "./types"

export default function SocialQueue({ initialRows, autoPublish, initialTerm, curations, curationError = false, statusUnavailable = false }: {
  initialRows: CardnewsRow[]; autoPublish: boolean | null; initialTerm?: string; curations: CurationRow[]; curationError?: boolean; statusUnavailable?: boolean
}) {
  const ops = useSocialOperations({ initialRows, autoPublish, initialTerm })
  const [view, setView] = useState("queue")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [selected, setSelected] = useState(initialRows[0]?.articleId || "")
  const [generateOpen, setGenerateOpen] = useState(!!initialTerm)
  const generateRef = useRef<HTMLButtonElement>(null)
  const needle = search.trim().toLowerCase()
  const matches = (row: CardnewsRow) => [row.hook, row.title, row.category].join(" ").toLowerCase().includes(needle)
  const visible = ops.rows.filter(row => matches(row) && (view === "scheduled" ? rowStatus(row) === "scheduled" : view === "posted" ? !!(row.postedAt || row.reelsPostedAt) : !row.postedAt))
    .filter(row => filter === "all" || (filter === "todo" ? !row.cardAt : !!row.cardAt))
  const active = visible.find(row => row.articleId === selected) || visible[0]
  return <div className="social-workspace">
    <div className="social-page-heading"><div><p>SOCIAL</p><h2>Social publishing workspace</h2><span>최근 최대 100개 Published Insight 기반 · {ops.rows.length}개 불러옴</span></div><button ref={generateRef} className="admin-control admin-primary" onClick={() => setGenerateOpen(true)}>Generate</button></div>
    {statusUnavailable && <p className="social-notice" role="alert">게시·예약 컬럼을 읽을 수 없습니다. 해당 상태를 확정하지 않습니다. 기존 생성·preview는 사용할 수 있습니다.</p>}
    <div className="social-views" role="group" aria-label="Social views">{[["queue", "Queue"], ["scheduled", "Scheduled"], ["posted", "Posted"], ["curations", "Curations"]].map(([key, label]) => <button key={key} aria-pressed={view === key} disabled={statusUnavailable && (key === "scheduled" || key === "posted")} onClick={() => setView(key)}>{label}{key !== "curations" && <small>{ops.rows.filter(row => key === "queue" ? !row.postedAt : key === "scheduled" ? rowStatus(row) === "scheduled" : !!(row.postedAt || row.reelsPostedAt)).length}</small>}</button>)}</div>
    {view === "curations" ? <section className="social-curations"><p className="admin-note">CURATION · read-only · 별도 7장 contract. 생성·수정·삭제 기능을 제공하지 않습니다.</p>{curationError ? <p role="alert">Curations를 불러오지 못했습니다. 페이지를 다시 불러와 확인하세요.</p> : !curations.length ? <p role="status">저장된 Curations가 없습니다.</p> : curations.map(row => <article key={row.id}><div><strong>{row.week_of} / CURATION</strong><p>{row.slides[0]?.headline ? [row.slides[0].headline].flat().join(" ") : "제목 기록 없음"}</p><p>{row.caption}</p></div><span>{row.slides.length} slides</span><span>{row.posted_at ? `게시 기록 ${socialDate(row.posted_at)}` : "게시 기록 없음"}</span>{row.ig_post_id && <small>Instagram ID {row.ig_post_id}</small>}</article>)}</section> : <>
      <div className="social-filter-bar"><label><span className="sr-only">불러온 Social 검색</span><input type="search" placeholder="제목·Hook·카테고리 검색" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="생성 상태" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">모든 생성 상태</option><option value="todo">미생성</option><option value="generated">생성됨</option></select><span role="status">{visible.length}개 표시</span><Link href="/admin/calendar">Calendar →</Link></div>
      <p className="admin-note">검색·view·count는 불러온 Insight 범위에만 적용됩니다. 자동발행 {ops.auto === null ? "조회 실패" : ops.auto ? "ON" : "OFF"} · 채널별 성공 기록과 내부 게시 표시는 구분합니다.</p>
      <div className="social-queue-layout"><section className="social-list" aria-label="Social queue 목록">
        {!visible.length && <div className="admin-empty" role="status">{view === "scheduled" ? "예약된 콘텐츠가 없습니다." : view === "posted" ? "게시 기록이 있는 콘텐츠가 없습니다." : "현재 조건에 맞는 Queue 콘텐츠가 없습니다."}</div>}
        {visible.map(row => <article key={row.articleId} className={`social-row ${active?.articleId === row.articleId ? "is-selected" : ""}`}>
          <button className="social-row-select" aria-pressed={active?.articleId === row.articleId} aria-label={`${row.hook || row.title} Preview 선택`} onClick={() => setSelected(row.articleId)}><RenderImage retry={false} key={row.cardAt} src={`/api/admin/cardnews/render?articleId=${row.articleId}&slide=1&v=${encodeURIComponent(row.cardAt || row.createdAt)}`} alt="Carousel 표지" /></button>
          <div className="social-row-content"><p className="social-format">CAROUSEL{row.slides?.some(slide => slide.role) ? " / V2" : row.slides?.length ? " / Legacy" : ""}{row.slides?.length ? ` · ${row.slides.length} slides` : ""}{row.reelsPostedAt ? " · REEL 게시 기록" : ""}</p><button className="social-row-title" onClick={() => setSelected(row.articleId)}>{row.hook || row.title}</button><p className="admin-note">{row.category} · {statusUnavailable ? "게시·예약 상태 조회 불가" : rowStatus(row) === "todo" ? "미생성" : rowStatus(row) === "posted" ? "Carousel 게시 기록 있음" : rowStatus(row) === "scheduled" ? "예약됨" : "생성됨 / 검수 대기"}</p>
            {row.scheduledAt && <p className="social-row-time">예약 {socialDate(row.scheduledAt)}</p>}{row.postedAt && <p className="social-row-time">게시 기록 {socialDate(row.postedAt)}{row.igPostId ? " · Instagram ID 있음" : " · Instagram ID 없음"}</p>}{row.igStats && <p className="admin-note">Instagram 도달 {row.igStats.reach} · 저장 {row.igStats.saved} · 좋아요 {row.igStats.likes}</p>}
            <SocialActions row={row} ops={ops} unavailable={statusUnavailable} /></div>
        </article>)}
      </section>{active && <SocialPreview key={active.articleId} row={active} />}</div>
    </>}
    <SocialDialog open={generateOpen} onClose={() => setGenerateOpen(false)} title="Social 생성" description="기존 Carousel / 용어카드 생성 API를 사용합니다. 새 format이나 발행 설정은 추가하지 않습니다." returnFocus={generateRef} busy={ops.termBusy || !!ops.bulkProgress}>
      <label className="social-field">용어·꿀팁<input value={ops.term} onChange={event => ops.setTerm(event.target.value)} placeholder="예: CTR이 뭐예요" /></label>
      <button className="admin-control admin-primary" disabled={ops.termBusy || !!ops.bulkProgress} onClick={ops.generateTerm}>{ops.termBusy ? "생성 중…" : "용어카드 생성"}</button>
      <div className="social-generate-bulk"><p>현재 불러온 미생성 {ops.rows.filter(row => !row.cardAt).length}개 대상</p><button className="admin-control" disabled={!!ops.bulkProgress || ops.termBusy || !ops.rows.some(row => !row.cardAt)} onClick={ops.generateMissing}>미생성 일괄 생성</button>{ops.bulkProgress && <><p role="status">{ops.bulkProgress}</p><button className="admin-control" onClick={ops.stopBulk}>현재 작업 후 중단</button></>}</div>
      <details><summary>기존 자동발행 설정</summary><p className="admin-note">매일 미발행 대상 자동 게시에 영향을 줍니다. 현재 {ops.auto === null ? "조회 실패" : ops.auto ? "ON" : "OFF"}.</p><button className="admin-control" disabled={ops.auto === null} onClick={ops.toggleAuto}>자동발행 {ops.auto ? "OFF로 변경" : "ON으로 변경"}</button></details>
      <div className="admin-confirm-buttons"><button className="admin-control" autoFocus disabled={ops.termBusy || !!ops.bulkProgress} onClick={() => setGenerateOpen(false)}>닫기</button></div>
    </SocialDialog>
    <SocialResults ops={ops} />
  </div>
}
