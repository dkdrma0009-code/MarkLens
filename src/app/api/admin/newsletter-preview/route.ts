import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { buildNewsletterHtml } from "@/lib/newsletter/html"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const issueId = searchParams.get("id")
  if (!issueId) return new Response("id required", { status: 400 })

  const db = createAdminClient()
  const { data: issue } = await db.from("newsletter_issues").select("*").eq("id", issueId).single()
  if (!issue) return new Response("Not found", { status: 404 })

  const { data: imgPool } = await db
    .from("articles")
    .select("image_url")
    .eq("status", "published")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(30)
  const issueNum = issue.issue_number ?? 0
  const heroImage = imgPool?.length
    ? imgPool[issueNum % imgPool.length]?.image_url ?? null
    : null

  return new Response(buildNewsletterHtml(issue, { heroImage }), { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
