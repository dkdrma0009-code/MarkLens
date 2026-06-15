import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateNewsletter } from "@/lib/ai/newsletter"
import { searchUnsplash } from "@/lib/newsletter/unsplash"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  // n8n 웹훅 시크릿 or 로그인된 어드민 둘 중 하나 통과
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  const isN8n = secret === process.env.N8N_WEBHOOK_SECRET

  if (!isN8n) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const isAdmin = !!user && user.email?.trim().toLowerCase() === adminEmail
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  const supabase = createAdminClient()

  // 최근 발행된 인사이트 가져오기
  const { data: insights } = await supabase
    .from("insights")
    .select("*, article:articles(title, source_name)")
    .order("created_at", { ascending: false })
    .limit(10)

  if (!insights || insights.length === 0) {
    return NextResponse.json({ error: "No insights available" }, { status: 400 })
  }

  // 다음 호 번호 계산
  const { data: lastIssue } = await supabase
    .from("newsletter_issues")
    .select("issue_number")
    .order("issue_number", { ascending: false })
    .limit(1)
    .single()

  const nextIssueNumber = (lastIssue?.issue_number ?? 0) + 1

  try {
    const newsletter = await generateNewsletter({
      issueNumber: nextIssueNumber,
      insights: insights.map((i) => ({
        title: i.article?.title ?? "",
        summary: i.summary ?? "",
        category: i.category,
        why_it_matters: i.why_it_matters,
        practical_applications: i.practical_applications,
        key_takeaways: Array.isArray(i.key_takeaways) ? i.key_takeaways : undefined,
      })),
    })

    // image_keywords는 사진 검색용 메타 — DB 컬럼이 아니므로 분리 후 삽입
    const { image_keywords, ...issueFields } = newsletter

    // 본문 사진 — Unsplash에서 주제 키워드로 검색 (키 없거나 결과 없으면 null → 텍스트만 폴백)
    const query = image_keywords.length
      ? image_keywords.join(" ")
      : (newsletter.topic_headline ?? "").split(/\s+/).slice(0, 3).join(" ")
    const photo = await searchUnsplash(query)

    const { data, error } = await supabase
      .from("newsletter_issues")
      .insert({
        issue_number: nextIssueNumber,
        ...issueFields,
        body_image_url: photo?.url ?? null,
        body_image_credit: photo?.credit ?? null,
        body_image_credit_link: photo?.creditLink ?? null,
        status: "draft",
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, issue: data })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 })
  }
}
