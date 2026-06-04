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
    .limit(5)

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: "No pending articles", analyzed: 0 })
  }

  const cleanStr = (s: string) => s.replace(/﻿/g, "").trim()

  // 아티클 병렬 처리 — 순차 처리 대비 ~3배 빠름
  const results = await Promise.allSettled(
    articles.map(async (article) => {
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
        throw new Error(`${article.title}: hook 없음`)
      }

      const { error: upsertError } = await supabase.from("insights").upsert(
        { article_id: article.id, ...insight, slug },
        { onConflict: "slug" }
      )
      if (upsertError) throw new Error(`insight upsert: ${upsertError.message}`)

      await supabase.from("articles").update({ status: "ready" }).eq("id", article.id)
      return article.title
    })
  )

  const analyzed = results.filter(r => r.status === "fulfilled").length
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map(r => r.reason instanceof Error ? r.reason.message : String(r.reason))

  // 실패한 아티클 중 아직 analyzing 상태인 건 pending으로 복귀
  await Promise.all(
    articles
      .filter((_, i) => results[i].status === "rejected")
      .map(a =>
        supabase.from("articles")
          .update({ status: "pending" })
          .eq("id", a.id)
          .eq("status", "analyzing")
      )
  )

  return NextResponse.json({
    success: true,
    analyzed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
