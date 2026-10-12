import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { revalidatePublicContent } from "@/lib/revalidate"
import { NextResponse } from "next/server"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  // 삭제 후엔 slug를 조회할 수 없으므로 캐시 무효화용 slug를 미리 확보
  const { data: linked } = await supabase.from("insights").select("slug").eq("article_id", id)

  // insight 먼저 삭제 후 article 삭제
  await supabase.from("insights").delete().eq("article_id", id)
  const { error } = await supabase.from("articles").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublicContent({ slugs: (linked ?? []).map((r) => r.slug) }) // 삭제한 글의 상세만 + 홈·목록
  return NextResponse.json({ success: true })
}
