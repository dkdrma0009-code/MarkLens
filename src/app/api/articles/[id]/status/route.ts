import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { revalidatePublicContent } from "@/lib/revalidate"
import { NextResponse } from "next/server"

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

  // 발행/비발행 변경은 공개 페이지(홈·목록·상세)에 즉시 반영되어야 한다 (ISR 캐시 무효화)
  revalidatePublicContent()

  return NextResponse.json({ success: true })
}
