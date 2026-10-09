"use client"
import { useState } from "react"
import Link from "next/link"
import RenderImage from "./RenderImage"
import { socialDate, type CardnewsRow } from "./types"

export default function SocialPreview({ row }: { row: CardnewsRow }) {
  const [index, setIndex] = useState(0)
  const slides = row.slides || []
  const current = Math.min(index, Math.max(0, slides.length - 1))
  return <aside className="social-preview-panel" aria-label="선택한 콘텐츠 Preview">
    <div className="social-preview-heading"><p>CAROUSEL / PREVIEW</p><h3>{row.hook || row.title}</h3></div>
    <RenderImage key={`${row.articleId}-${current}-${row.cardAt}`} src={`/api/admin/cardnews/render?articleId=${encodeURIComponent(row.articleId)}&slide=${current + 1}&v=${encodeURIComponent(row.cardAt || row.createdAt)}`} alt={`${row.hook || row.title} ${current + 1}장`} />
    {!row.cardAt && <p className="admin-note">미생성 · 기존 render API의 Insight 기반 표지 preview입니다.</p>}
    {slides.length > 0 && <div className="social-slide-rail" role="group" aria-label="Preview 장 선택">{slides.map((slide, i) => <button className="admin-control" key={i} aria-pressed={current === i} onClick={() => setIndex(i)}>{String(i + 1).padStart(2, "0")}{slide.role ? ` ${slide.role.toUpperCase()}` : ""}</button>)}</div>}
    <p className="social-caption-excerpt">{row.caption || "저장된 caption이 없습니다."}</p>
    <dl className="social-preview-meta"><dt>예약</dt><dd>{socialDate(row.scheduledAt)}</dd><dt>Carousel 게시 기록</dt><dd>{socialDate(row.postedAt)}</dd><dt>Reel 게시 기록</dt><dd>{socialDate(row.reelsPostedAt)}</dd>{row.igPostId && <><dt>Instagram post ID</dt><dd>{row.igPostId}</dd></>}</dl>
    <Link className="admin-control" href={`/admin/cardnews/${row.articleId}`}>Carousel Studio →</Link>{row.cardAt && <Link className="admin-control" href={`/admin/cardnews/${row.articleId}?format=reel`}>Reel Studio →</Link>}
  </aside>
}
