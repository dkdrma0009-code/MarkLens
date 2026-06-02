import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeArticle } from "@/lib/ai/analyze"
import { slugify } from "@/lib/utils"
import { NextResponse } from "next/server"

export const maxDuration = 300

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // pending 상태 아티클 최대 2개씩 처리 (Vercel 타임아웃 방지)
  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "pending")
    .not("raw_content", "is", null)
    .order("created_at", { ascending: true })
    .limit(2)

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: "No pending articles", analyzed: 0 })
  }

  let analyzed = 0
  const errors: string[] = []

  for (const article of articles) {
    try {
      // analyzing 상태로 변경
      await supabase
        .from("articles")
        .update({ status: "analyzing" })
        .eq("id", article.id)

      const cleanStr = (s: string) => s.replace(/\uFEFF/g, "").trim()
      const insight = await analyzeArticle({
        title: cleanStr(article.title),
        content: cleanStr(article.raw_content ?? article.title),
        url: cleanStr(article.url),
      })

      // slug 중복 방지
      const baseSlug = slugify(article.title)
      const slug = `${baseSlug}-${article.id.slice(0, 6)}`

      const { error: upsertError } = await supabase.from("insights").upsert(
        { article_id: article.id, ...insight, slug },
        { onConflict: "slug" }
      )

      if (upsertError) throw new Error(`insight upsert: ${upsertError.message}`)

      await supabase
        .from("articles")
        .update({ status: "ready" })
        .eq("id", article.id)

      analyzed++
    } catch (err: any) {
      errors.push(`${article.title}: ${err.message}`)
      await supabase
        .from("articles")
        .update({ status: "pending" })
        .eq("id", article.id)
    }
  }

  return NextResponse.json({
    success: true,
    analyzed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
