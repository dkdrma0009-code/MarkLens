import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeArticle } from "@/lib/ai/analyze"
import { summarizeError } from "@/lib/ai/errors"
import { buildInsightSlug } from "@/lib/utils"
import { freshSourceFilter } from "@/lib/content/auto-publish"
import { parseExclude, pickCandidates } from "@/lib/analysis/candidates"
import { assertUsableHook } from "@/lib/analysis/quality"
import { NextResponse } from "next/server"

export const maxDuration = 300

// Response contract (the collect cron reads it):
//   no candidates          → 200 { message: "No pending articles", attempted: 0 }
//   some analyzed/rejected → 200 { attempted, analyzed, rejected, failed, partial: failed > 0, errors }
//   every attempt failed   → 502 { ...same fields } — an outage, not a quiet day
// `ids` lists the articles tried, so the caller can exclude them from its next call in the same run.
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 분석 순서: 기본 asc(오래된 순 — 기존 호출자 동작 유지). desc = 최신 우선(그날 수집분 우선 분석).
  const newestFirst = searchParams.get("order") === "desc"
  const exclude = parseExclude(searchParams.get("exclude"))

  const supabase = createAdminClient()

  // A wider pool than one batch, so articles tried in this run or failed recently can be skipped (candidates.ts).
  const { data: pool, error: poolError } = await supabase
    .from("articles")
    .select("id, title, raw_content, url, created_at, updated_at")
    .eq("status", "pending")
    .not("raw_content", "is", null)
    .or(freshSourceFilter()) // 원문 7일 초과 기사는 자동 공개 대상이 아니므로 유료 분석도 하지 않는다(삭제·상태 변경 없음)
    .order("created_at", { ascending: !newestFirst })
    .limit(30)
  if (poolError) return NextResponse.json({ error: `pending query: ${poolError.message}` }, { status: 500 })

  // 분석이 article당 2패스(생성+refine)로 무거워 배치는 3건 — 크론 타임아웃 방지
  const { picked: articles, skipped } = pickCandidates(pool ?? [], { exclude, limit: 3 })
  if (articles.length === 0) {
    return NextResponse.json({ message: "No pending articles", attempted: 0, analyzed: 0, skipped })
  }

  const cleanStr = (s: string) => s.replace(/﻿/g, "").trim()

  let analyzed = 0, rejected = 0, failed = 0
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
        rejected++
        errors.push(`${article.id.slice(0, 8)}: hook 없음`)
        return
      }
      await assertUsableHook(supabase, insight.hook, article.id) // copied example or a title already in use → failed, retried later

      const { error: upsertError } = await supabase.from("insights").upsert(
        { article_id: article.id, ...insight, slug },
        { onConflict: "slug" }
      )
      if (upsertError) throw new Error(`insight upsert: ${upsertError.message}`)

      await supabase.from("articles").update({ status: "ready" }).eq("id", article.id)
      analyzed++
    } catch (err) {
      failed++
      errors.push(`${article.id.slice(0, 8)}: ${summarizeError(err)}`)
      // Back to pending; the update also moves updated_at, which starts the retry cooldown.
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

  const attempted = articles.length
  const body = {
    success: failed === 0,
    attempted, analyzed, rejected, failed,
    partial: failed > 0 && analyzed + rejected > 0,
    ids: articles.map(a => a.id),
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  }
  if (failed > 0) console.warn("[analyze-pending]", JSON.stringify({ attempted, analyzed, rejected, failed, errors }))
  return NextResponse.json(body, { status: failed === attempted ? 502 : 200 })
}
