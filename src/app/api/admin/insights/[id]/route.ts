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
  const { data: edited, error } = await supabase.from("insights").update(updates).eq("id", id).select("slug")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublicContent({ slugs: (edited ?? []).map((r) => r.slug) }) // 편집한 글의 상세만 + 홈·목록
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
    .select("article_id, slug") // 삭제 후엔 slug를 조회할 수 없으므로 미리 확보
    .eq("id", id)
    .single()

  if (!insight) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await supabase.from("insights").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from("articles")
    .update({ status: "pending" })
    .eq("id", insight.article_id)

  revalidatePublicContent({ slugs: [insight.slug] }) // 삭제한 글의 상세만 + 홈·목록
  return NextResponse.json({ success: true })
}
