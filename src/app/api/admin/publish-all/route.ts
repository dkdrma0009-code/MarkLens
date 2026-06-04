import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()

  // 인사이트(hook+summary)가 있는 ready 아티클만 발행
  const { data: readyArticles } = await db
    .from("articles")
    .select("id, insights(hook, summary)")
    .eq("status", "ready")

  const validIds = (readyArticles ?? [])
    .filter(a => a.insights?.[0]?.hook && a.insights?.[0]?.summary)
    .map(a => a.id)

  if (validIds.length === 0) {
    return NextResponse.json({ published: 0 })
  }

  await db.from("articles").update({ status: "published" }).in("id", validIds)

  return NextResponse.json({ success: true, published: validIds.length })
}
