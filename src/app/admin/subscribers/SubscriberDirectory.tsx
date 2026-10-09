"use client"
import { useState } from "react"
import { ContentStatus } from "@/components/admin-v2/ContentQueue"
import { socialDate } from "@/components/admin-v2/social/types"
import SubscriberExport from "./SubscriberExport"
export interface SubscriberRow { id: string; email: string; status: string; source: string | null; subscribed_at: string; unsubscribed_at: string | null }
export default function SubscriberDirectory({ rows }: { rows: SubscriberRow[] }) {
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("")
  const sources = [...new Set(rows.map(row => row.source).filter((value): value is string => !!value))].sort()
  const filtered = rows.filter(row => row.email.toLowerCase().includes(search.trim().toLowerCase()) && (!source || (source === "__missing" ? !row.source : row.source === source)))
  return <><div className="admin-filter-bar"><label className="admin-search-label"><span className="sr-only">불러온 구독자 이메일 검색</span><input type="search" placeholder="불러온 이메일 검색" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="불러온 구독자 유입 경로" value={source} onChange={event => setSource(event.target.value)}><option value="">모든 유입 경로</option><option value="__missing">기록 없음</option>{sources.map(value => <option key={value}>{value}</option>)}</select><SubscriberExport subscribers={filtered} /></div><p className="admin-note" role="status">{rows.length}명 불러옴 · {filtered.length}명 표시 · 검색/필터와 CSV는 현재 불러온 결과에만 적용됩니다.</p><div className="audience-distribution">{["active", "pending", "unsubscribed"].map(status => <span key={status}>{status} <strong>{rows.filter(row => row.status === status).length}</strong></span>)}</div>{!filtered.length ? <div className="admin-empty" role="status">{rows.length ? "현재 조건에 맞는 구독자가 없습니다." : "조회된 구독자가 없습니다."}</div> : <div className="admin-content-table-wrap"><table className="admin-content-table audience-table"><caption className="sr-only">현재 조회·필터된 구독자 목록</caption><thead><tr>{["Email", "Status", "Source", "Subscribed / KST", "Unsubscribed / KST"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td data-label="Email"><h3>{row.email}</h3></td><td data-label="Status"><ContentStatus status={row.status} /></td><td data-label="Source">{row.source || "기록 없음"}</td><td data-label="Subscribed"><time dateTime={row.subscribed_at}>{socialDate(row.subscribed_at)}</time></td><td data-label="Unsubscribed">{socialDate(row.unsubscribed_at)}</td></tr>)}</tbody></table></div>}</>
}
