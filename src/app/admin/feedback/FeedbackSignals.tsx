"use client"
import { useState } from "react"
import { socialDate } from "@/components/admin-v2/social/types"
export interface FeedbackRow { id: string; rating: number | null; liked: string | null; disliked: string | null; role: string | null; will_subscribe: string | null; created_at: string }
const labels = ["", "별로예요", "아쉬워요", "괜찮아요", "좋아요", "최고예요"]
export default function FeedbackSignals({ rows }: { rows: FeedbackRow[] }) {
  const [rating, setRating] = useState("")
  const [since, setSince] = useState("")
  const filtered = rows.filter(row => (!rating || String(row.rating) === rating) && (!since || new Date(new Date(row.created_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10) >= since))
  return <><div className="admin-filter-bar"><select aria-label="불러온 응답 별점" value={rating} onChange={event => setRating(event.target.value)}><option value="">모든 별점</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5 · {labels[value]}</option>)}</select><label className="signal-date-filter">KST 시작일<input type="date" value={since} onChange={event => setSince(event.target.value)} /></label><span role="status" className="admin-filter-result">{filtered.length}개 표시 / {rows.length}개 불러옴</span></div><p className="admin-note">필터는 불러온 응답에만 적용됩니다. 별점 label은 실제 공개 피드백 설문의 1–5점 정의입니다. 응답별 route는 현재 저장 계약에 없습니다.</p>{!filtered.length ? <div className="admin-empty" role="status">{rows.length ? "현재 조건에 맞는 응답이 없습니다." : "조회된 응답이 없습니다."}</div> : <section className="feedback-signals" aria-label="Site feedback responses">{filtered.map(row => <article key={row.id}><header><div><strong>{row.rating === null ? "별점 기록 없음" : `${row.rating} / 5`}</strong><span>{row.rating !== null ? labels[row.rating] || "저장된 값" : ""}</span><span>{row.role || "역할 기록 없음"}</span></div><time dateTime={row.created_at}>{socialDate(row.created_at)}</time></header><p className="admin-note">구독 의향: {row.will_subscribe || "기록 없음"} · Site feedback</p>{row.liked && <div><h3>좋았던 점</h3><p>{row.liked}</p></div>}{row.disliked && <div><h3>아쉬운 점</h3><p>{row.disliked}</p></div>}{!row.liked && !row.disliked && <p className="admin-note">서술 응답 없음</p>}</article>)}</section>}</>
}
