import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import { socialDate } from "@/components/admin-v2/social/types"
import { ToggleSource, AddSourceForm } from "./RssSourceActions"
export const dynamic = "force-dynamic"
export default async function AdminSourcesPage() {
  await requireAdmin()
  const result = await createAdminClient().from("rss_sources").select("*", { count: "exact" }).order("name").limit(200)
  return <div className="ops-workspace"><div className="social-page-heading"><div><p>INGESTION SOURCES</p><h2>RSS intake operations</h2><span>이름순 최대 200개 · 전체 DB {result.error || result.count === null ? "조회 실패" : `${result.count}개`}</span></div><AddSourceForm /></div><p className="admin-note">활성 소스는 기존 자동 RSS 수집 대상입니다. 저장된 수집 시각은 성공률·uptime을 뜻하지 않습니다.</p>{result.error ? <ContentError /> : !result.data?.length ? <div className="admin-empty" role="status">등록된 RSS 소스가 없습니다.</div> : <><p className="admin-note">{result.data.length}개 불러옴 · 이 중 활성 {result.data.filter(row => row.is_active).length}개</p><div className="admin-content-table-wrap"><table className="admin-content-table sources-table"><caption className="sr-only">RSS sources and stored collection timestamps</caption><thead><tr>{["Source / Website", "Slug", "RSS URL", "Stored fetch time / KST", "Collection state"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{result.data.map(source => <tr key={source.id}><td data-label="Source"><h3><a href={source.website_url} target="_blank" rel="noopener noreferrer">{source.name}</a></h3></td><td data-label="Slug">{source.slug}</td><td data-label="RSS URL"><a href={source.rss_url} target="_blank" rel="noopener noreferrer">{source.rss_url}</a></td><td data-label="Stored fetch time">{socialDate(source.last_fetched_at)}</td><td data-label="Collection state"><ToggleSource id={source.id} name={source.name} isActive={source.is_active} /></td></tr>)}</tbody></table></div></>}</div>
}
