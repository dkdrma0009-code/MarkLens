import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeArticle } from "@/lib/ai/analyze"
import { slugify } from "@/lib/utils"
import { NextResponse } from "next/server"

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

async function generateQuiz(content: string): Promise<object | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `너는 마케팅 교육 전문가야. 주어진 글을 읽고 핵심 내용을 테스트하는 4지선다 퀴즈 1문제를 만들어줘. 반드시 아래 JSON 형식으로만 응답해. 설명이나 마크다운 없이 JSON만.\n{"questions":[{"question":"문제","options":["① 보기1","② 보기2","③ 보기3","④ 보기4"],"answer":0,"explanation":"해설"}]}\nanswer는 정답 인덱스(0~3).` }] },
          contents: [{ parts: [{ text: content.slice(0, 2000) }] }],
        }),
      }
    )
    const data = await res.json()
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
      .replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

export const maxDuration = 300

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  // pending 상태 아티클 최대 3개씩 처리
  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "pending")
    .not("raw_content", "is", null)
    .order("created_at", { ascending: true })
    .limit(3)

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

      // 핵심 3개 필드 없으면 거절 (빈 인사이트 방지)
      const hasContent = insight.hook && insight.summary && insight.why_it_matters
      if (!hasContent) {
        await supabase.from("articles").update({ status: "rejected" }).eq("id", article.id)
        errors.push(`${article.title}: 분석 내용 부족`)
        continue
      }

      // 퀴즈 자동 생성 (분석과 동시)
      const quizContent = [insight.why_it_matters, insight.practical_applications, insight.summary]
        .filter(Boolean).join("\n\n")
      const quiz = quizContent.length > 100 ? await generateQuiz(quizContent) : null

      const { error: upsertError } = await supabase.from("insights").upsert(
        { article_id: article.id, ...insight, slug, ...(quiz ? { quiz } : {}) },
        { onConflict: "slug" }
      )

      if (upsertError) throw new Error(`insight upsert: ${upsertError.message}`)

      await supabase
        .from("articles")
        .update({ status: "ready" })
        .eq("id", article.id)

      analyzed++
    } catch (err) {
      errors.push(`${article.title}: ${err instanceof Error ? err.message : String(err)}`)
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
