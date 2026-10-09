import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { redirect } from "next/navigation"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import ChallengeForm from "./_components/ChallengeForm"
export const dynamic = "force-dynamic"
export default async function AdminInsightLabPage() {
  if (!await isAdmin()) redirect("/")
  const result = await createAdminClient().from("insight_challenges").select("*", { count: "exact" }).order("published_date", { ascending: false }).limit(30)
  const initialDate = new Date().toISOString().slice(0, 10)
  return <div className="ops-workspace"><div className="social-page-heading"><div><p>CHALLENGES</p><h2>Career Lab content operations</h2><span>발행일순 최대 30개 · 전체 DB {result.error || result.count === null ? "조회 실패" : `${result.count}개`}</span></div><a className="admin-control admin-primary" href="#new-challenge">New challenge ↓</a></div><div className="challenge-operations"><section aria-label="Challenge list"><div className="ops-panel-heading"><div><p>CONTENT / STORED RECORDS</p><h3>Challenge list</h3></div></div>{result.error ? <ContentError /> : !result.data?.length ? <div className="admin-empty" role="status">등록된 Challenge가 없습니다.</div> : <div className="challenge-list">{result.data.map(row => <article key={row.id}><div><strong>{row.title}</strong><p>{row.published_date} · {row.category} · {row.difficulty}</p><span className="admin-content-status">{row.active ? "활성" : "비활성"}</span></div><p>{row.summary}</p><small>출처: {row.source_name || "기록 없음"}</small></article>)}</div>}</section><section id="new-challenge" className="challenge-new"><p className="ops-eyebrow">NEW / EXISTING API</p><h3>새 Challenge 등록</h3><p className="admin-note">기존 active 설정과 발행일을 사용합니다. 별도 승인 workflow는 없습니다.</p><ChallengeForm initialDate={initialDate} /></section></div></div>
}
