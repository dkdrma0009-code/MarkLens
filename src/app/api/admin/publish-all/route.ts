import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePublicContent } from "@/lib/revalidate"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || !adminEmail || user.email?.trim().toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()

  // 인사이트(hook+summary)가 있는 ready 아티클만 발행
  const { data: readyArticles } = await db
    .from("articles")
    .select("id, insights(hook, summary, slug)")
    .eq("status", "ready")

  const validArticles = (readyArticles ?? [])
    .filter(a => a.insights?.[0]?.hook && a.insights?.[0]?.summary)
  const validIds = validArticles.map(a => a.id)

  if (validIds.length === 0) {
    return NextResponse.json({ published: 0 })
  }

  await db.from("articles").update({ status: "published" }).in("id", validIds)

  // 이번에 발행한 글의 상세만 + 홈·목록 (ISR 캐시 무효화)
  revalidatePublicContent({ slugs: validArticles.flatMap(a => (a.insights ?? []).map(i => i.slug)) })
  return NextResponse.json({ success: true, published: validIds.length })
}
