import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeArticle } from "@/lib/ai/analyze"
import { buildInsightSlug } from "@/lib/utils"
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
    .limit(3) // 분석이 article당 2패스(생성+refine)로 무거워져 배치 축소 — 크론 타임아웃 방지

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: "No pending articles", analyzed: 0 })
  }

  const cleanStr = (s: string) => s.replace(/﻿/g, "").trim()

  // 2개씩 병렬 처리 (속도 ↑, rate limit 안전)
  let analyzed = 0
  const errors: string[] = []

  type PendingArticle = { id: string; title: string; raw_content: string | null; url: string }
  async function processOne(article: PendingArticle) {
    try {
      await supabase.from("articles").update({ status: "analyzing" }).eq("id", article.id)

      const insight = await analyzeArticle({
        title: cleanStr(article.title),
        content: cleanStr(article.raw_content ?? article.title),
        url: cleanStr(article.url),
      })

      // ASCII 슬러그(영문 title 우선 → hook → insight) + id6 유니크 해시
      const slug = buildInsightSlug(article.title, insight.hook, article.id)

      if (!insight.hook) {
        await supabase.from("articles").update({ status: "rejected" }).eq("id", article.id)
        errors.push(`${article.title}: hook 없음`)
        return
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
      await supabase.from("articles")
        .update({ status: "pending" })
        .eq("id", article.id)
        .eq("status", "analyzing")
    }
  }

  // 2개씩 묶어서 병렬 실행
  for (let i = 0; i < articles.length; i += 2) {
    const batch = articles.slice(i, i + 2)
    await Promise.all(batch.map(processOne))
  }

  return NextResponse.json({
    success: true,
    analyzed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
