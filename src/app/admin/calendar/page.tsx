import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getInstagramInsights } from "@/lib/instagram"
import { getThreadsInsights } from "@/lib/threads"
import CalendarView, { type CalendarRecord } from "./CalendarView"

export const dynamic = "force-dynamic"
export default async function CalendarPage() {
  await requireAdmin()
  const now = new Date()
  const today = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const monday = new Date(`${today}T00:00:00Z`)
  const dow = monday.getUTCDay()
  monday.setUTCDate(monday.getUTCDate() + (dow === 0 ? -6 : 1 - dow))
  const start = new Date(monday.getTime() - 7 * 86400 * 1000 - 9 * 3600 * 1000).toISOString()
  const end = new Date(monday.getTime() + 14 * 86400 * 1000 - 9 * 3600 * 1000).toISOString()
  const range = ["scheduled_at", "posted_at", "reels_posted_at"].map(field => `and(${field}.gte.${start},${field}.lt.${end})`).join(",")
  const [igData, threadsData, records] = await Promise.all([
    getInstagramInsights(), getThreadsInsights(),
    createAdminClient().from("cardnews").select("article_id,scheduled_at,posted_at,reels_posted_at,ig_post_id,caption,article:articles(title)").or(range).limit(300),
  ])
  return <div className="ops-workspace"><div className="social-page-heading"><div><p>DISTRIBUTION CALENDAR</p><h2>Publishing timeline</h2><span>지난주 · 이번주 · 다음주 / KST</span></div></div><CalendarView today={today} records={(records.data || []) as unknown as CalendarRecord[]} queryError={!!records.error} igData={igData} threadsData={threadsData} /></div>
}
