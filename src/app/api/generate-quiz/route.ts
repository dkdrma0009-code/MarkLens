import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const maxDuration = 60

// 어드민 세션 또는 웹훅 시크릿 — 무인증 호출은 Gemini 비용·퀴즈 덮어쓰기 악용 가능
async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

async function generateQuiz(content: string): Promise<object | null> {
  const system = `너는 마케팅 교육 전문가야. 주어진 글을 읽고 핵심 내용을 테스트하는 4지선다 퀴즈 1문제를 만들어줘.
반드시 아래 JSON 형식으로만 응답해. 설명이나 마크다운 없이 JSON만.
{"questions":[{"question":"문제","options":["① 보기1","② 보기2","③ 보기3","④ 보기4"],"answer":0,"explanation":"해설"}]}
answer는 정답 인덱스(0~3). 난이도는 본문 읽으면 알 수 있지만 그냥 상식으론 헷갈리는 수준.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: content.slice(0, 2000) }] }],
      }),
    }
  )
  const data = await res.json()
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
    .replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { insightId, content } = await req.json()
  if (!insightId || typeof content !== "string" || !content) {
    return NextResponse.json({ error: "insightId and content required" }, { status: 400 })
  }

  const quiz = await generateQuiz(content)
  if (!quiz) {
    return NextResponse.json({ error: "Quiz generation failed" }, { status: 500 })
  }

  const supabase = createAdminClient()
  await supabase.from("insights").update({ quiz }).eq("id", insightId)

  return NextResponse.json({ success: true, quiz })
}
