import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { analyzeCompetition } from "@/lib/competitions/analyze"
import { NextResponse } from "next/server"

export const maxDuration = 120

// 주최사/공모전 URL 입력 기반 분석 (수집 이원화의 주축).
// URL fetch → 본문 텍스트 추출 → LLM 분류(description 자체 재작성) → competitions insert.
async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 페이지에서 제목 + 본문 텍스트 추출 (외부 이미지는 가져오지 않음 — 텍스트 썸네일 정책)
async function fetchPageText(url: string): Promise<{ title: string; text: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "MarkLens/1.0" },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`페이지 응답 오류 (${res.status})`)
  const html = await res.text()

  const meta = (re: RegExp) => html.match(re)?.[1]?.trim()
  const ogTitle = meta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  const titleTag = meta(/<title[^>]*>([^<]+)<\/title>/i)
  const ogDesc = meta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  const title = ogTitle ?? titleTag ?? "(제목 없음)"

  // 스크립트·스타일 제거 후 태그 제거, 공백 정규화
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000)

  return { title, text: `${title}\n${ogDesc ?? ""}\n${body}` }
}

export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { url } = await req.json().catch(() => ({}))
  if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "유효한 URL을 입력하세요" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 중복 체크 (source_url unique)
  const { data: dup } = await supabase.from("competitions").select("id").eq("source_url", url).maybeSingle()
  if (dup) return NextResponse.json({ error: "이미 등록된 URL입니다", id: dup.id }, { status: 409 })

  let page: { title: string; text: string }
  try {
    page = await fetchPageText(url)
  } catch (e) {
    return NextResponse.json({ error: `페이지를 가져오지 못했습니다: ${e instanceof Error ? e.message : e}` }, { status: 502 })
  }

  const analysis = await analyzeCompetition({ title: page.title, content: page.text, url })
  if (!analysis?.title) return NextResponse.json({ error: "분석에 실패했습니다" }, { status: 500 })

  let sourceName = "직접 등록"
  try { sourceName = new URL(url).hostname.replace(/^www\./, "") } catch { /* keep default */ }

  const { data, error } = await supabase.from("competitions").insert({
    title: analysis.title,
    organizer: analysis.organizer,
    source_url: url,
    source_name: sourceName,
    description: analysis.description,
    category: analysis.category,
    deadline: analysis.deadline,
    start_date: analysis.start_date,
    prize: analysis.prize,
    eligibility: analysis.eligibility,
    job_fit: analysis.job_fit ?? [],
    difficulty: analysis.difficulty,
    status: "pending",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, competition: data })
}
