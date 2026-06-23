import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { revalidatePublicContent } from "@/lib/revalidate"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const allowed = ["hook", "summary", "key_takeaways", "why_it_matters", "practical_applications", "framework_analysis", "portfolio_usage", "interview_points", "category", "video_url"]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("insights").update(updates).eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublicContent() // 편집 내용이 캐시된 공개 페이지에 즉시 반영되게
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
    .update({ status: "pending" })
    .eq("id", insight.article_id)

  revalidatePublicContent() // 삭제·비공개 전환이 캐시된 공개 페이지에 즉시 반영되게
  return NextResponse.json({ success: true })
}
