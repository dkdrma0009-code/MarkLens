"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ArticleActions from "@/app/admin/articles/ArticleActions"
import InsightActions from "@/app/admin/insights/InsightActions"
import EditInsight from "@/app/admin/articles/EditInsight"
import ShareCopy from "@/app/admin/insights/ShareCopy"
import InsightPreview from "@/app/admin/articles/InsightPreview"
import AnalyzeTrigger from "@/app/admin/articles/AnalyzeTrigger"
import CollectTrigger from "@/app/admin/articles/CollectTrigger"
import PublishAllTrigger from "@/app/admin/articles/PublishAllTrigger"
import DeleteRejectedButton from "@/app/admin/articles/DeleteRejectedButton"

export interface ContentRow {
  id: string; articleId: string; title: string; hook?: string | null; source?: string | null;
  status: string; category?: string | null; createdAt: string; sourcePublished?: string | null;
  sitePublished?: string | null; image: boolean; insightId?: string; slug?: string | null;
  hasInsight: boolean; url?: string; rawContent?: string | null; imageUrl?: string | null; summary?: string | null; tags?: string[] | null
}
export function ContentError() {
  const router = useRouter()
  return <div className="admin-content-error" role="alert"><p>데이터를 불러오지 못했습니다.</p><button className="admin-control" onClick={() => router.refresh()}>다시 시도</button></div>
}
function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "기록 없음"
}
export function ContentStatus({ status }: { status: string }) {
  if (status === "unknown") return <span className="admin-data-error">연결 Article 없음</span>
  return <span className={`admin-content-status admin-status-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
}
export default function ContentQueue({ rows, kind, isCase = false }: { rows: ContentRow[]; kind: "articles" | "insights"; isCase?: boolean }) {
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const articles = kind === "articles"
  const statuses = articles ? ["pending", "analyzing", "ready", "published", "rejected"] : ["ready", "published"]
  const categories = [...new Set(rows.map(row => row.category).filter((value): value is string => !!value))].sort()
  const needle = search.trim().toLocaleLowerCase()
  const filtered = rows.filter(row => (status === "all" || row.status === status) && (!category || row.category === category) && (!needle || [row.title, row.hook, row.source, row.category].join(" ").toLocaleLowerCase().includes(needle)))
  return <div className="admin-content-queue">
    <div className="admin-content-header"><div><p>{articles ? "ARTICLES" : "INSIGHTS"}</p><h2>{articles ? "Inbound content queue" : "Editorial output library"}</h2><span>최근 최대 {articles ? 100 : 200}개 {articles ? (isCase ? "캠페인 기사" : "일반 기사") : "Insight"} · {rows.length}개 불러옴</span></div>{articles && <CollectTrigger />}</div>
    {articles && <nav className="admin-source-tabs" aria-label="기사 유형"><Link aria-current={!isCase ? "page" : undefined} href="/admin/articles">일반 기사</Link><Link aria-current={isCase ? "page" : undefined} href="/admin/articles?type=case">캠페인</Link></nav>}
    <div className="admin-status-filters" role="group" aria-label="현재 불러온 항목의 상태 필터">
      {["all", ...statuses].map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "all" ? "불러온 전체" : value.charAt(0).toUpperCase() + value.slice(1)}<span>{value === "all" ? rows.length : rows.filter(row => row.status === value).length}</span></button>)}
    </div>
    <div className="admin-filter-bar"><label className="admin-search-label"><span className="sr-only">현재 불러온 항목 검색</span><input type="search" placeholder="현재 불러온 항목 검색" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select aria-label="현재 불러온 항목의 카테고리" value={category} onChange={e => setCategory(e.target.value)}><option value="">모든 카테고리</option>{categories.map(value => <option key={value}>{value}</option>)}</select>
      <span className="admin-filter-result" role="status">{filtered.length}개 표시</span>
    </div>
    {articles && <div className="admin-bulk-bar"><span>전체 DB 대상 작업 · 현재 필터와 무관</span><AnalyzeTrigger pendingCount={rows.filter(row => row.status === "pending").length} /><PublishAllTrigger readyCount={rows.filter(row => row.status === "ready").length} /><DeleteRejectedButton count={rows.filter(row => row.status === "rejected").length} /></div>}
    <p className="admin-content-scope">필터·검색·카테고리와 상태별 숫자는 현재 불러온 결과에만 적용됩니다.</p>
    {!filtered.length ? <div className="admin-empty" role="status">{status === "all" ? "현재 조건에 맞는 콘텐츠가 없습니다." : `${status.charAt(0).toUpperCase()+status.slice(1)} 콘텐츠가 없습니다.`}</div> :
      <div className="admin-content-table-wrap"><table className="admin-content-table"><thead><tr><th scope="col">{articles ? "Content / Source" : "Hook / Title"}</th><th scope="col">Status</th><th scope="col">{articles ? "Collected / Source published" : "Created / Site published"}</th><th scope="col">Image / Insight</th><th scope="col">Actions</th></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}>
          <td data-label="Content"><h3>{!articles && row.hook ? row.hook : row.title}</h3>{!articles && row.hook && row.hook !== row.title && <p className="admin-original-title">{row.title}</p>}<p className="admin-row-source">{row.source || "출처 기록 없음"}{row.category ? ` / ${row.category}` : ""}</p></td>
          <td data-label="Status"><ContentStatus status={row.status} /></td>
          <td data-label={articles ? "Collected / Source published" : "Created / Site published"}><time dateTime={row.createdAt}>{date(row.createdAt)}</time><small>{articles ? `원문 발행 ${date(row.sourcePublished)}` : `자동 사이트 기록 ${date(row.sitePublished)}`}</small>{articles && row.sitePublished && <small>사이트 기록 {date(row.sitePublished)}</small>}</td>
          <td data-label="Image / Insight"><span className={!row.image ? "admin-missing-url" : ""}>{row.image ? "Image URL 있음" : "Image URL missing"}</span><small>{row.hasInsight ? "Hook · Summary 있음" : "Insight 미완성 / 없음"}</small></td>
          <td data-label="Actions"><div className="admin-content-actions">
            {!articles && row.status === "published" && row.slug && <ShareCopy hook={row.hook} summary={row.summary} slug={row.slug} category={row.category} tags={row.tags} />}
            {row.slug ? <Link className="admin-control" href={`/admin/preview/${encodeURIComponent(row.slug)}`}>검수 Preview</Link> : articles && <InsightPreview articleId={row.articleId} articleTitle={row.title} articleUrl={row.url || ""} sourceName={row.source || ""} rawContent={row.rawContent} imageUrl={row.imageUrl} hasInsight={!!row.insightId} />}
            {articles ? <>{row.insightId && <EditInsight insightId={row.insightId} />}<ArticleActions articleId={row.articleId} status={row.status} hasInsight={row.hasInsight} title={row.title} /></> : <InsightActions insightId={row.id} title={row.hook || row.title} />}
          </div></td>
        </tr>)}</tbody></table></div>}
  </div>
}
