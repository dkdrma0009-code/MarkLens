import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateUnsubscribeUrl } from "@/app/api/unsubscribe/route"
import { NextResponse } from "next/server"
import type { NewsletterIssue } from "@/types"

const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"

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

async function fetchHeroImage(supabase: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await supabase
    .from("articles")
    .select("image_url")
    .eq("status", "published")
    .not("image_url", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .single()
  return (data as any)?.image_url ?? null
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  const isN8n = secret === process.env.N8N_WEBHOOK_SECRET
  if (!isN8n && !await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const issueId = body.issueId ?? body.issue?.id
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 })

  const supabase = createAdminClient()
  const { data: issue } = await supabase.from("newsletter_issues").select("*").eq("id", issueId).single()
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 })

  const { data: subscribers } = await supabase.from("subscribers").select("email").eq("status", "active")
  if (!subscribers?.length) return NextResponse.json({ error: "No active subscribers" }, { status: 400 })

  const heroImage = await fetchHeroImage(supabase)
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()
  const subject = `[MarkLens] ${cleanTitle}`
  let sent = 0
  const errors: string[] = []

  for (const { email } of subscribers) {
    try {
      const unsubscribeUrl = await generateUnsubscribeUrl(email)
      await sendViaBrevo(email, subject, buildHtml(issue, unsubscribeUrl, heroImage))
      sent++
    } catch (e) {
      errors.push(`${email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (sent > 0) {
    await supabase.from("newsletter_issues")
      .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", issueId)
  }

  return NextResponse.json({ success: sent > 0, sentTo: sent, errors: errors.length ? errors : undefined })
}

function sentences(content: string): string[] {
  return content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

function buildHtml(issue: NewsletterIssue, unsubscribeUrl = "", heroImage: string | null = null): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const issueNumMatch = issue.title.match(/^#(\d+)/)
  const issueNum = issueNumMatch ? issueNumMatch[1] : ""
  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()

  // 01 — This Week's Signals: 다크 임팩트 카드
  function signalsSection(content: string): string {
    const parts = sentences(content)
    const [lead, ...rest] = parts
    return `
    <tr><td style="padding:0 24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:14px;overflow:hidden;">
        <tr><td style="height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed);font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:22px 26px 8px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#4f46e5;${F}">📡 01 · This Week's Signals</p>
          <p style="margin:0 0 16px;font-size:18px;font-weight:800;color:#ffffff;line-height:1.4;letter-spacing:-0.3px;${F}">${lead ?? ""}</p>
          ${rest.map(s => `<p style="margin:0 0 12px;font-size:14px;color:#aaa;line-height:1.8;${F}">${s}</p>`).join("")}
        </td></tr>
        <tr><td style="height:16px;"></td></tr>
      </table>
    </td></tr>`
  }

  // 02 — Case of the Week: 왼쪽 컬러 바 강조
  function caseSection(content: string): string {
    const parts = sentences(content)
    const [lead, ...rest] = parts
    return `
    <tr><td style="padding:0 24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:14px;overflow:hidden;border:1px solid #eeeeee;">
        <tr>
          <td style="width:4px;background:linear-gradient(180deg,#0891b2,#0e7490);border-radius:14px 0 0 14px;font-size:0;">&nbsp;</td>
          <td style="padding:22px 22px 18px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#0891b2;${F}">🔍 02 · Case of the Week</p>
            <p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0a0a0a;line-height:1.4;${F}">${lead ?? ""}</p>
            ${rest.map(s => `<p style="margin:0 0 10px;font-size:14px;color:#444;line-height:1.8;${F}">${s}</p>`).join("")}
          </td>
        </tr>
      </table>
    </td></tr>`
  }

  // 03 — AI Brief: 초록 강조 카드
  function aiSection(content: string): string {
    const parts = sentences(content)
    return `
    <tr><td style="padding:0 24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:14px;overflow:hidden;border:1px solid #bbf7d0;">
        <tr><td style="padding:20px 22px 16px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#059669;${F}">🤖 03 · AI Marketing Brief</p>
          ${parts.map(s => `<p style="margin:0 0 10px;font-size:14px;color:#1a4731;line-height:1.8;${F}">${s}</p>`).join("")}
        </td></tr>
      </table>
    </td></tr>`
  }

  // 04 — Portfolio: 보라 카드
  function portfolioSection(content: string): string {
    const parts = sentences(content)
    return `
    <tr><td style="padding:0 24px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border-radius:14px;overflow:hidden;border:1px solid #e9d5ff;">
        <tr><td style="padding:20px 22px 16px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7c3aed;${F}">📁 04 · Portfolio Insight</p>
          <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;${F}">구독자 전용</p>
          ${parts.map(s => `<p style="margin:0 0 10px;font-size:14px;color:#3b1f6e;line-height:1.8;${F}">${s}</p>`).join("")}
        </td></tr>
      </table>
    </td></tr>`
  }

  // 05 — Career Lens: 액션 박스
  function careerSection(content: string): string {
    const parts = sentences(content)
    return `
    <tr><td style="padding:0 24px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:14px;overflow:hidden;border:1px solid #fde68a;">
        <tr><td style="padding:20px 22px 16px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#d97706;${F}">🎯 05 · Career Lens</p>
          <p style="margin:0 0 12px;font-size:11px;color:#9ca3af;${F}">오늘의 액션</p>
          ${parts.map(s => `<p style="margin:0 0 10px;font-size:14px;color:#78350f;line-height:1.8;${F}">${s}</p>`).join("")}
        </td></tr>
      </table>
    </td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${cleanTitle}</title>
</head>
<body style="margin:0;padding:0;background:#eeebe6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeebe6;">
<tr><td align="center" style="padding:24px 12px 32px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- 헤더 -->
  <tr><td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:32px 32px 28px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#555;letter-spacing:0.18em;text-transform:uppercase;${F}">MarkLens Weekly${issueNum ? ` &nbsp;·&nbsp; Issue #${issueNum}` : ""}</p>
        <h1 style="margin:10px 0 14px;font-size:26px;font-weight:900;color:#fff;line-height:1.3;letter-spacing:-0.5px;${F}">${cleanTitle}</h1>
        <p style="margin:0;font-size:11px;color:#555;${F}">${today}</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- 히어로 이미지 -->
  ${heroImage ? `<tr><td style="padding:0;background:#0a0a0a;"><img src="${heroImage}" alt="" width="600" style="width:100%;display:block;max-height:280px;object-fit:cover;opacity:0.92;"/></td></tr>` : ""}

  <!-- 본문 카드 -->
  <tr><td style="background:#ffffff;padding:20px 0 8px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${issue.week_signals ? signalsSection(issue.week_signals) : ""}
      ${issue.case_of_week ? caseSection(issue.case_of_week) : ""}
      ${issue.ai_brief ? aiSection(issue.ai_brief) : ""}
      ${issue.portfolio_insight ? portfolioSection(issue.portfolio_insight) : ""}
      ${issue.career_lens ? careerSection(issue.career_lens) : ""}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="background:#ffffff;padding:0 24px 32px;text-align:center;">
    <a href="https://marklens.site/insights"
      style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 36px;border-radius:100px;letter-spacing:-0.2px;${F}">
      마케팅 인사이트 더 보기 →
    </a>
  </td></tr>

  <!-- 푸터 -->
  <tr><td style="background:#f0ede8;border-radius:0 0 16px 16px;border-top:1px solid #e0ddd8;padding:22px 24px;text-align:center;">
    <p style="margin:0 0 3px;font-size:13px;font-weight:800;color:#0a0a0a;${F}">MarkLens</p>
    <p style="margin:0 0 12px;font-size:11px;color:#bbb;${F}">Where Marketing Trends Become Action</p>
    <p style="margin:0;font-size:11px;color:#bbb;${F}">
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
