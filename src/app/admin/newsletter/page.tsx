import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import NewsletterControls, { type IssueRow } from "./NewsletterControls"

export const dynamic = "force-dynamic"
export default async function AdminNewsletterPage() {
  await requireAdmin()
  const db = createAdminClient()
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 60)
  const [issues, subscribers, unsubs] = await Promise.all([
    db.from("newsletter_issues").select("*").order("issue_number", { ascending: false }).limit(20),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "active"),
    db.from("subscribers").select("unsubscribed_at").not("unsubscribed_at", "is", null).gte("unsubscribed_at", cutoff.toISOString()),
  ])
  if (issues.error) return <div className="ops-workspace"><ContentError /></div>
  const departures: Record<string, number> = {}
  for (const issue of issues.data || []) {
    if (!issue.sent_at) continue
    const timestamp = new Date(issue.sent_at).getTime()
    departures[issue.id] = (unsubs.data || []).filter(row => { const t = new Date(row.unsubscribed_at).getTime(); return t >= timestamp && t <= timestamp + 48 * 3600 * 1000 }).length
  }
  return <NewsletterControls issues={(issues.data || []) as IssueRow[]} subscriberCount={subscribers.error ? null : subscribers.count} departures={unsubs.error ? null : departures} testRecipient={process.env.ADMIN_EMAIL?.trim() || null} />
}
