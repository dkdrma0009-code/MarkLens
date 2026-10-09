import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import SubscriberDirectory, { type SubscriberRow } from "./SubscriberDirectory"

export const dynamic = "force-dynamic"
export default async function AdminSubscribersPage() {
  await requireAdmin()
  const result = await createAdminClient().from("subscribers")
    .select("id,email,status,source,subscribed_at,unsubscribed_at", { count: "exact" })
    .order("subscribed_at", { ascending: false }).limit(1000)
  return <div className="ops-workspace"><div className="social-page-heading"><div><p>AUDIENCE</p><h2>Audience directory</h2><span>최근 최대 1,000개 · 전체 DB {result.error || result.count === null ? "조회 실패" : `${result.count}명`}</span></div></div>{result.error ? <ContentError /> : <SubscriberDirectory rows={(result.data || []) as SubscriberRow[]} />}</div>
}
