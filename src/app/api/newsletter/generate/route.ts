import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateNewsletter } from "@/lib/ai/newsletter"
import { searchUnsplash } from "@/lib/newsletter/unsplash"
import { getUpcomingCompetitions } from "@/lib/competitions/digest"
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

    // 마감 임박 공모전 섹션 추가 (데이터 있을 때만)
    const competitions = await getUpcomingCompetitions(3)
    if (competitions.length > 0) {
      newsletter.body_sections.push({
        subhead: "이번 주 마감 임박 공모전",
        paragraphs: competitions.map(c => {
          const d = c.deadline ? `마감 ~${c.deadline.slice(5).replace("-", "/")}` : "상시"
          const org = c.organizer ? ` (${c.organizer})` : ""
          return `${c.title}${org} — ${d}`
        }),
      })
    }

    // 섹션별 본문 사진 — 각 섹션 image_keywords로 Unsplash 검색 → visual에 저장 (키/결과 없으면 텍스트만)
    const utm = "utm_source=marklens&utm_medium=referral"
    await Promise.all(newsletter.body_sections.map(async (s) => {
      const query = s.image_keywords?.length
        ? s.image_keywords.join(" ")
        : `${s.subhead} ${newsletter.topic_headline ?? ""}`.trim()
      const photo = await searchUnsplash(query)
      if (photo) {
        s.visual = {
          type: "photo",
          url: photo.url,
          caption: `Photo by <a href="${photo.creditLink}?${utm}" style="color:#aaa;text-decoration:none;">${photo.credit}</a> on <a href="https://unsplash.com/?${utm}" style="color:#aaa;text-decoration:none;">Unsplash</a>`,
        }
      }
      delete s.image_keywords // 검색용 메타 — DB에 저장하지 않음
    }))

    const { data, error } = await supabase
      .from("newsletter_issues")
      .insert({
        issue_number: nextIssueNumber,
        ...newsletter,
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
