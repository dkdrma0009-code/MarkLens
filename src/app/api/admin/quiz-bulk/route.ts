import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export const maxDuration = 300

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? ""

async function generateQuiz(content: string): Promise<object | null> {
  const system = `너는 마케팅 교육 전문가야. 주어진 글을 읽고 핵심 내용을 테스트하는 4지선다 퀴즈 1문제를 만들어줘.
반드시 아래 JSON 형식으로만 응답해. 설명이나 마크다운 없이 JSON만.
{"questions":[{"question":"문제","options":["① 보기1","② 보기2","③ 보기3","④ 보기4"],"answer":0,"explanation":"해설"}]}
answer는 정답 인덱스(0~3).`

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
  try { return JSON.parse(match[0]) } catch { return null }
}

export async function POST() {
  const supabase = createAdminClient()

  const { data: insights } = await supabase
    .from("insights")
    .select("id, why_it_matters, practical_applications, summary, article:articles(title, raw_content)")
    .is("quiz", null)
    .limit(30)

  let generated = 0
  for (const row of (insights ?? [])) {
    const content = (row.article as any)?.raw_content
      || [row.why_it_matters, row.practical_applications, row.summary].filter(Boolean).join("\n\n")
      || ""
    if (content.length < 100) continue

    const quiz = await generateQuiz(content)
    if (quiz) {
      await supabase.from("insights").update({ quiz }).eq("id", row.id)
      generated++
    }
    await new Promise(r => setTimeout(r, 400))
  }

  return NextResponse.json({ success: true, generated })
}
