import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateNewsletter } from "@/lib/ai/newsletter"
import { isHotlinkBlocked } from "@/lib/images"
import { searchUnsplash } from "@/lib/unsplash"
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
    .select("*, article:articles(title, source_name, image_url)")
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

    // source_index·image_query는 비주얼 선정용 메타 — DB 컬럼이 아니므로 분리 후 삽입
    const { source_index, image_query, ...issueFields } = newsletter

    // 본문 비주얼 — 주제 기사 실사진(프레스킷 격) + Unsplash 분위기 사진 병행
    const sections = issueFields.body_sections
    if (sections?.length) {
      const chosen = insights[source_index - 1] ?? insights[0]
      const pressUrl = chosen?.article?.image_url
      if (pressUrl && !isHotlinkBlocked(pressUrl)) {
        sections[0].visual = { type: "photo", url: pressUrl, caption: chosen?.article?.source_name ?? "" }
        // 병행: 마지막 섹션에 Unsplash 분위기 사진 (키 있을 때만, 리드와 중복 안 되게)
        if (sections.length > 1) {
          const u = await searchUnsplash(image_query)
          if (u) sections[sections.length - 1].visual = { type: "photo", url: u.url, caption: u.caption }
        }
      } else {
        // 프레스 이미지 없거나 차단 → 리드 섹션을 Unsplash로
        const u = await searchUnsplash(image_query)
        if (u) sections[0].visual = { type: "photo", url: u.url, caption: u.caption }
      }
    }

    const { data, error } = await supabase
      .from("newsletter_issues")
      .insert({
        issue_number: nextIssueNumber,
        ...issueFields,
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
