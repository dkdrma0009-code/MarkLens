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
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { status } = await req.json()

  const validStatuses = ["pending", "analyzing", "ready", "published", "rejected"]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // published로 변경 시 인사이트 내용 검증
  if (status === "published") {
    const { data: insight } = await supabase
      .from("insights")
      .select("hook, summary")
      .eq("article_id", id)
      .single()

    if (!insight?.hook || !insight?.summary) {
      return NextResponse.json({
        error: "인사이트 내용이 없습니다. 분석을 먼저 완료해주세요."
      }, { status: 400 })
    }
  }

  const { error } = await supabase.from("articles").update({ status }).eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
