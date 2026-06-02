import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

export async function GET(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const articleId = searchParams.get("articleId")
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const supabase = createAdminClient()
  const { data: insight } = await supabase
    .from("insights")
    .select("id, hook, summary, key_takeaways, why_it_matters, practical_applications, framework_analysis, portfolio_usage, interview_points, category")
    .eq("article_id", articleId)
    .single()

  if (!insight) return NextResponse.json({ error: "Insight not found" }, { status: 404 })
  return NextResponse.json({ insight })
}
