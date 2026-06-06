import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateUnsubscribeUrl } from "@/app/api/unsubscribe/route"
import { NextResponse } from "next/server"
import type { NewsletterIssue } from "@/types"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

async function sendViaBrevo(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "MarkLens", email: "newsletter@marklens.site" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) throw new Error(`Brevo error: ${await res.text()}`)
}

// 최신 발행 인사이트 이미지 가져오기 (섹션별로 사용)
async function fetchFeaturedImages(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from("insights")
    .select("hook, article:articles!inner(image_url, title)")
    .eq("articles.status", "published")
    .not("articles.image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(6)
  return (data ?? [])
    .map((i: any) => ({ hook: i.hook, image_url: i.article?.image_url, title: i.article?.title }))
    .filter(i => i.image_url)
}

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { issueId } = await req.json()
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 })

  const supabase = createAdminClient()

  const { data: issue } = await supabase
    .from("newsletter_issues").select("*").eq("id", issueId).single()
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 })

  const { data: subscribers } = await supabase
    .from("subscribers").select("email").eq("status", "active")
  if (!subscribers?.length) return NextResponse.json({ error: "No active subscribers" }, { status: 400 })

  const featuredImages = await fetchFeaturedImages(supabase)
  const subject = `MarkLens Weekly ${issue.title}`
  let sent = 0
  const errors: string[] = []

  for (const { email } of subscribers) {
    try {
      const unsubscribeUrl = await generateUnsubscribeUrl(email)
      await sendViaBrevo(email, subject, buildNewsletterHtml(issue, unsubscribeUrl, featuredImages))
      sent++
    } catch (e: any) {
      errors.push(`${email}: ${e.message}`)
    }
  }

  await supabase.from("newsletter_issues")
    .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", issueId)

  return NextResponse.json({ success: true, sentTo: sent, errors: errors.length ? errors : undefined })
}

type FeaturedImage = { hook: string; image_url: string; title: string }

function buildNewsletterHtml(issue: NewsletterIssue, unsubscribeUrl = "", images: FeaturedImage[] = []): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const heroImg = images[0]
  const caseImg = images[1] ?? images[0]

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${issue.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f0;">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">

  <!-- 헤더 -->
  <tr><td style="background:#0a0a0a;padding:32px 40px 28px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#666;letter-spacing:0.15em;text-transform:uppercase;">MarkLens Weekly</p>
    <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">${issue.title}</h1>
    <p style="margin:10px 0 0;font-size:12px;color:#666;">${today}</p>
  </td></tr>

  <!-- 구분선 -->
  <tr><td style="height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#ec4899);"></td></tr>

  <!-- 목차 박스 -->
  <tr><td style="padding:28px 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f6;border-radius:8px;border:1px solid #e8e8e4;">
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#999;letter-spacing:0.12em;text-transform:uppercase;">이번 호 목차</p>
      ${[
        "01 / This Week's Signals",
        "02 / Case of the Week",
        "03 / AI Marketing Brief",
        "04 / Portfolio Insight ✦",
        "05 / Career Lens ✦",
      ].map((item, i) => `<p style="margin:0 0 6px;font-size:13px;color:#333;font-weight:${i < 2 ? "600" : "400"};"><span style="color:#999;margin-right:4px;">${item.split("/")[0]}/</span>${item.split("/")[1]}</p>`).join("")}
    </td></tr></table>
  </td></tr>

  <!-- 히어로 이미지 (있을 때) -->
  ${heroImg ? `<tr><td style="padding:0 40px 24px;">
    <img src="${heroImg.image_url}" alt="${heroImg.title}" width="520" style="width:100%;max-width:520px;border-radius:8px;display:block;object-fit:cover;height:260px;"/>
  </td></tr>` : ""}

  <!-- 01 This Week's Signals -->
  ${issue.week_signals ? buildSection("01", "This Week's Signals", issue.week_signals) : ""}

  <!-- 02 Case of the Week -->
  ${issue.case_of_week ? buildSectionWithImage("02", "Case of the Week", issue.case_of_week, caseImg?.image_url) : ""}

  <!-- 03 AI Marketing Brief -->
  ${issue.ai_brief ? buildSection("03", "AI Marketing Brief", issue.ai_brief) : ""}

  <!-- 04 Portfolio Insight -->
  ${issue.portfolio_insight ? buildSection("04", "Portfolio Insight ✦", issue.portfolio_insight, "#faf5ff", "#7c3aed") : ""}

  <!-- 05 Career Lens -->
  ${issue.career_lens ? buildSection("05", "Career Lens ✦", issue.career_lens, "#f0fdf4", "#16a34a") : ""}

  <!-- CTA 버튼 -->
  <tr><td style="padding:8px 40px 32px;text-align:center;">
    <a href="https://marklens.site/insights" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 32px;border-radius:100px;letter-spacing:-0.2px;">
      마케팅 인사이트 더 보기 →
    </a>
  </td></tr>

  <!-- 구분선 -->
  <tr><td style="height:1px;background:#e8e8e4;margin:0 40px;"></td></tr>

  <!-- 푸터 -->
  <tr><td style="padding:28px 40px;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0a0a0a;">MarkLens</p>
    <p style="margin:0 0 16px;font-size:11px;color:#999;">Where Marketing Trends Become Action</p>
    <p style="margin:0;font-size:11px;color:#bbb;">
      <a href="https://marklens.site" style="color:#999;text-decoration:none;">marklens.site</a>
      &nbsp;·&nbsp;
      <a href="${unsubscribeUrl}" style="color:#999;text-decoration:none;">구독 취소</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function buildSection(num: string, title: string, content: string, bgColor = "#fff", accentColor = "#4f46e5"): string {
  return `<tr><td style="padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};border-radius:8px;border:1px solid #e8e8e4;overflow:hidden;">
    <tr><td style="padding:20px 24px 16px;border-bottom:1px solid #e8e8e4;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accentColor};">${num} /</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:800;color:#0a0a0a;letter-spacing:-0.3px;">${title}</p>
    </td></tr>
    <tr><td style="padding:20px 24px;">
      <p style="margin:0;font-size:14px;color:#333;line-height:1.85;white-space:pre-wrap;">${content}</p>
    </td></tr>
    </table>
  </td></tr>`
}

function buildSectionWithImage(num: string, title: string, content: string, imageUrl?: string): string {
  return `<tr><td style="padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e8e8e4;overflow:hidden;">
    <tr><td style="padding:20px 24px 16px;border-bottom:1px solid #e8e8e4;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4f46e5;">${num} /</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:800;color:#0a0a0a;letter-spacing:-0.3px;">${title}</p>
    </td></tr>
    ${imageUrl ? `<tr><td style="padding:0;"><img src="${imageUrl}" alt="Case of the Week" width="600" style="width:100%;display:block;object-fit:cover;height:220px;"/></td></tr>` : ""}
    <tr><td style="padding:20px 24px;">
      <p style="margin:0;font-size:14px;color:#333;line-height:1.85;white-space:pre-wrap;">${content}</p>
    </td></tr>
    </table>
  </td></tr>`
}
