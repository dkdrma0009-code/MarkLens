import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowed = ["hook", "summary", "key_takeaways", "why_it_matters", "practical_applications", "framework_analysis", "portfolio_usage", "interview_points", "category"]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("insights").update(updates).eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: insight } = await supabase
    .from("insights")
    .select("article_id")
    .eq("id", id)
    .single()

  if (!insight) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.from("insights").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from("articles")
    .update({ status: "ready" })
    .eq("id", insight.article_id)

  return NextResponse.json({ success: true })
}
