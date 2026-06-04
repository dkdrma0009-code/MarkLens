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

  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "pending")
    .not("raw_content", "is", null)
    .order("created_at", { ascending: true })
    .limit(10)

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: "No pending articles", analyzed: 0 })
  }

  const cleanStr = (s: string) => s.replace(/﻿/g, "").trim()

  // 순차 처리 — 병렬 시 Claude/OpenAI rate limit 충돌로 대부분 rejected 되는 문제 방지
  let analyzed = 0
  const errors: string[] = []

  for (const article of articles) {
    try {
      await supabase.from("articles").update({ status: "analyzing" }).eq("id", article.id)

      const insight = await analyzeArticle({
        title: cleanStr(article.title),
        content: cleanStr(article.raw_content ?? article.title),
        url: cleanStr(article.url),
      })

      const slug = `${slugify(article.title)}-${article.id.slice(0, 6)}`

      // hook만 없으면 거절 — 나머지 빈 필드는 수정 가능하므로 거절 안 함
      if (!insight.hook) {
        await supabase.from("articles").update({ status: "rejected" }).eq("id", article.id)
        errors.push(`${article.title}: hook 없음`)
        continue
      }

      const { error: upsertError } = await supabase.from("insights").upsert(
        { article_id: article.id, ...insight, slug },
        { onConflict: "slug" }
      )
      if (upsertError) throw new Error(`insight upsert: ${upsertError.message}`)

      await supabase.from("articles").update({ status: "ready" }).eq("id", article.id)
      analyzed++
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
      // 실패한 아티클은 pending으로 복귀 (재시도 가능)
      await supabase.from("articles")
        .update({ status: "pending" })
        .eq("id", article.id)
        .eq("status", "analyzing")
    }
  }

  return NextResponse.json({
    success: true,
    analyzed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
