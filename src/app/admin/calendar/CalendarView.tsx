"use client"
import { useState } from "react"
import Link from "next/link"
import type { IgInsights } from "@/lib/instagram"
import type { ThreadsInsights } from "@/lib/threads"
import { socialDate } from "@/components/admin-v2/social/types"
import { ContentError } from "@/components/admin-v2/ContentQueue"

export interface CalendarRecord { article_id: string; scheduled_at: string | null; posted_at: string | null; reels_posted_at: string | null; ig_post_id: string | null; caption: string | null; article: { title: string } | null }
interface Entry { key: string; timestamp: string; title: string; state: string; format: string; href: string; external?: boolean }
const dayPlans = ["휴식", "인사이트 카드 · Instagram/Threads", "용어카드 · Instagram", "케이스스터디 · Instagram/Threads", "Threads 텍스트", "릴스/숏츠 · Instagram", "뉴스레터 알림 · Instagram/Threads"]
const kstDay = (timestamp: string) => new Date(new Date(timestamp).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
export default function CalendarView({ today, records, queryError, igData, threadsData }: { today: string; records: CalendarRecord[]; queryError: boolean; igData: IgInsights | null; threadsData: ThreadsInsights | null }) {
  const [week, setWeek] = useState(0)
  const monday = new Date(`${today}T00:00:00Z`)
  const dow = monday.getUTCDay()
  monday.setUTCDate(monday.getUTCDate() + (dow === 0 ? -6 : 1 - dow) + week * 7)
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400 * 1000))
  const entries: Entry[] = []
  for (const record of records) {
    const title = record.article?.title || record.caption || "제목 기록 없음"
    const href = `/admin/cardnews/${record.article_id}`
    if (record.scheduled_at && !record.posted_at) entries.push({ key: `${record.article_id}:scheduled`, timestamp: record.scheduled_at, title, state: "Scheduled · DB 저장", format: "Instagram / Carousel", href })
    if (record.posted_at) entries.push({ key: `${record.article_id}:posted`, timestamp: record.posted_at, title, state: `내부 Carousel 게시 기록 · Instagram ID ${record.ig_post_id ? "있음" : "없음"}`, format: "Carousel", href })
    if (record.reels_posted_at) entries.push({ key: `${record.article_id}:reel`, timestamp: record.reels_posted_at, title, state: "내부 Reel 게시 기록", format: "Reel", href: href + "?format=reel" })
  }
  const storedIds = new Set(records.filter(row => row.posted_at || row.reels_posted_at).map(row => row.ig_post_id).filter(Boolean))
  for (const media of igData?.media || []) if (!storedIds.has(media.id)) entries.push({ key: `ig:${media.id}`, timestamp: media.timestamp, title: media.caption || "캡션 없음", state: "Instagram API 게시 이력", format: media.mediaType, href: media.permalink, external: true })
  for (const media of threadsData?.media || []) entries.push({ key: `threads:${media.id}`, timestamp: media.timestamp, title: media.text || "내용 없음", state: "Threads API 게시 이력", format: "Threads", href: media.permalink, external: true })
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const inWeek = entries.filter(entry => { const day = kstDay(entry.timestamp); return day >= days[0].toISOString().slice(0, 10) && day <= days[6].toISOString().slice(0, 10) })
  return <><div className="calendar-toolbar"><div className="social-views" role="group" aria-label="Calendar week">{[-1, 0, 1].map(value => <button key={value} aria-pressed={week === value} onClick={() => setWeek(value)}>{value === -1 ? "지난주" : value === 0 ? "이번주" : "다음주"}</button>)}</div><Link className="admin-control" href="/admin/cardnews">Social Queue →</Link></div><div className="calendar-range"><strong>{days[0].toISOString().slice(0, 10)} — {days[6].toISOString().slice(0, 10)}</strong><span>KST · 이 주에 확인된 항목 {inWeek.length}개</span></div>
    <p className="admin-note">DB 예약·내부 게시 기록과 플랫폼 API 게시 이력을 구분합니다. Threads 이력은 Threads API 데이터만 표시합니다. DB 조회는 3주 범위 최대 300개입니다.</p>{queryError && <ContentError />}{(!igData || !threadsData) && <p className="social-notice" role="status">{!igData && "Instagram 이력 조회 불가. "}{!threadsData && "Threads 이력 조회 불가. "}미연동과 조회 실패를 현재 getter가 구분하지 않습니다. 조회 불가는 게시물 없음과 다릅니다.</p>}
    {!queryError && !inWeek.length && <p className="admin-empty" role="status">이 주에 조회된 예약·게시 항목이 없습니다. 플랫폼 조회 불가 시 전체 이력의 부재를 확정하지 않습니다.</p>}
    <section className="calendar-week" aria-label="KST distribution agenda">{days.map(date => { const day = date.toISOString().slice(0, 10); const items = entries.filter(entry => kstDay(entry.timestamp) === day); return <section key={day} className={`calendar-day ${day === today ? "is-today" : ""}`} aria-label={`${day} ${weekdays[date.getUTCDay()]}`}><div className="calendar-day-heading"><strong>{day.slice(5)} <small>{weekdays[date.getUTCDay()]}</small></strong>{day === today && <span>TODAY</span>}</div><div className="calendar-day-items">{items.map(entry => <a key={entry.key} href={entry.href} target={entry.external ? "_blank" : undefined} rel={entry.external ? "noopener noreferrer" : undefined} className={`calendar-item ${entry.key.endsWith(":scheduled") ? "is-scheduled" : ""}`}><time dateTime={entry.timestamp}>{socialDate(entry.timestamp)}</time><span>{entry.format}</span><strong>{entry.title}</strong><small>{entry.state}</small></a>)}{!items.length && <p className="admin-note">{queryError ? "DB 조회 실패" : "조회된 항목 없음"}</p>}</div></section> })}</section>
    <details className="calendar-reference"><summary>기존 주간 콘텐츠 참고 계획</summary><p className="admin-note">정적 참고표입니다. 예약된 작업이나 실제 실행을 의미하지 않습니다.</p><div>{[1, 2, 3, 4, 5, 6, 0].map(day => <p key={day}><strong>{weekdays[day]}</strong>{dayPlans[day]}</p>)}</div></details>
    <section className="calendar-platform-history"><div className="ops-panel-heading"><div><p>PLATFORM / OBSERVED HISTORY</p><h3>최근 게시물과 계정</h3></div></div>{igData && <><p>Instagram @{igData.account.username} · 팔로워 {igData.account.followers} · 게시물 {igData.account.mediaCount} · API 최근 도달 합계 {igData.dailyReach.reduce((total, day) => total + day.reach, 0)}</p>{igData.media.map(media => <article key={media.id}><a href={media.permalink} target="_blank" rel="noopener noreferrer">{media.caption || "캡션 없음"}</a><time dateTime={media.timestamp}>{socialDate(media.timestamp)} · {media.mediaType}</time><p>도달 {media.reach} · 좋아요 {media.likes} · 저장 {media.saved} · 공유 {media.shares} · 댓글 {media.comments}</p></article>)}</>}{threadsData && <><p>Threads @{threadsData.account.username} · 팔로워 {threadsData.account.followers} · API 총 조회 {threadsData.totalViews}</p>{threadsData.media.map(media => <article key={media.id}><a href={media.permalink} target="_blank" rel="noopener noreferrer">{media.text || "내용 없음"}</a><time dateTime={media.timestamp}>{socialDate(media.timestamp)}</time><p>조회 {media.views} · 좋아요 {media.likes} · 답글 {media.replies} · 리포스트 {media.reposts} · 인용 {media.quotes}</p></article>)}</>}</section>
    <p className="admin-note">예약 API의 기존 날짜 계산은 유지됩니다. 선택 날짜와 실제 저장 시각이 다를 수 있으며 이 화면은 실제 timestamp만 KST로 표시합니다.</p></>
}
