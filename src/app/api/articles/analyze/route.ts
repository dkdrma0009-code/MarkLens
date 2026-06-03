import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { analyzeArticle } from "@/lib/ai/analyze"
import { NextResponse } from "next/server"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

export async function POST(req: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { articleId } = await req.json()
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const supabase = createAdminClient()

  const { data: article, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .single()

  if (error || !article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  // 상태를 analyzing으로 변경
  await supabase.from("articles").update({ status: "analyzing" }).eq("id", articleId)

  try {
    const insight = await analyzeArticle({
      title: article.title,
      content: article.raw_content ?? article.title,
      url: article.url,
    })

    // slug 중복 방지: article_id 기준 upsert
    const slug = `${insight.slug}-${articleId.slice(0, 6)}`
    const { error: insightError } = await supabase.from("insights").upsert(
      { article_id: articleId, ...insight, slug },
      { onConflict: "slug" }
    )

    if (insightError) throw insightError

    // 상태를 ready로 변경
    await supabase.from("articles").update({ status: "ready" }).eq("id", articleId)

    return NextResponse.json({ success: true, insight })
  } catch {
    await supabase.from("articles").update({ status: "pending" }).eq("id", articleId)
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 })
  }
}
