import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import FeedbackSignals, { type FeedbackRow } from "./FeedbackSignals"
export const dynamic = "force-dynamic"
export default async function AdminFeedbackPage() {
  await requireAdmin()
  const result = await createAdminClient().from("site_feedback").select("id,rating,liked,disliked,role,will_subscribe,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(200)
  return <div className="ops-workspace"><div className="social-page-heading"><div><p>AUDIENCE SIGNALS</p><h2>Qualitative audience signals</h2><span>Site feedback · 최근 최대 200개 · 전체 DB {result.error || result.count === null ? "조회 실패" : `${result.count}개`}</span></div></div>{result.error ? <ContentError /> : <FeedbackSignals rows={(result.data || []) as FeedbackRow[]} />}</div>
}
