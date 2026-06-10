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

async function fetchHeroImage(supabase: ReturnType<typeof createAdminClient>, issueNumber: number): Promise<string | null> {
  const { data } = await supabase
    .from("articles")
    .select("image_url")
    .eq("status", "published")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(30)
  if (!data?.length) return null
  const idx = issueNumber % data.length
  return (data[idx] as any)?.image_url ?? null
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

  const heroImage = await fetchHeroImage(supabase, issue.issue_number ?? 0)
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

  function signalSection(content: string): string {
    const [lead, ...rest] = sentences(content)
    return `
    <tr><td style="background:#111116;padding:32px 28px 26px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#818cf8;${F}">📡 01 · This Week's Signal</p>
      <p style="margin:0 0 18px;font-size:22px;font-weight:800;color:#f9f9f9;line-height:1.45;letter-spacing:-0.4px;${F}">${lead ?? ""}</p>
      ${rest.map(s => `<p style="margin:0 0 12px;font-size:15px;color:#aaa;line-height:1.8;${F}">${s}</p>`).join("")}
    </td></tr>`
  }

  function caseSection(content: string): string {
    const [lead, ...rest] = sentences(content)
    return `
    <tr><td style="background:#f5f7fa;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:4px;background:#0891b2;font-size:0;">&nbsp;</td>
          <td style="padding:30px 26px 24px;">
            <p style="margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0891b2;${F}">🔍 02 · Case of the Week</p>
            <p style="margin:0 0 18px;font-size:21px;font-weight:800;color:#111;line-height:1.45;${F}">${lead ?? ""}</p>
            ${rest.map(s => `<p style="margin:0 0 12px;font-size:15px;color:#444;line-height:1.8;${F}">${s}</p>`).join("")}
          </td>
        </tr>
      </table>
    </td></tr>`
  }

  function actionSection(content: string): string {
    const [lead, ...rest] = sentences(content)
    return `
    <tr><td style="background:#fffbeb;border-top:2px solid #fde68a;padding:30px 28px 24px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#d97706;${F}">🎯 03 · Action of the Week</p>
      <p style="margin:0 0 10px;font-size:12px;color:#b45309;font-weight:600;${F}">오늘 30분 안에 할 수 있어요 ⏱</p>
      <p style="margin:0 0 18px;font-size:21px;font-weight:800;color:#78350f;line-height:1.45;${F}">${lead ?? ""}</p>
      ${rest.map(s => `<p style="margin:0 0 12px;font-size:15px;color:#92400e;line-height:1.8;${F}">${s}</p>`).join("")}
    </td></tr>`
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${cleanTitle}</title>
</head>
<body style="margin:0;padding:0;background:#e8e5e0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8e5e0;">
<tr><td align="center" style="padding:24px 12px 32px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- 헤더 (컬러바 없음, 클린 블랙) -->
  <tr><td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:32px 32px 28px;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#4a4a4a;letter-spacing:0.18em;text-transform:uppercase;${F}">MarkLens Weekly${issueNum ? ` · Issue #${issueNum}` : ""}</p>
    <h1 style="margin:10px 0 14px;font-size:26px;font-weight:900;color:#ffffff;line-height:1.3;letter-spacing:-0.5px;${F}">${cleanTitle}</h1>
    <p style="margin:0;font-size:11px;color:#4a4a4a;${F}">${today}</p>
  </td></tr>

  <!-- 히어로 이미지 -->
  ${heroImage ? `<tr><td style="padding:0;background:#0d0d0d;"><img src="${heroImage}" alt="" width="600" style="width:100%;display:block;max-height:260px;object-fit:cover;"/></td></tr>` : ""}

  <!-- 3섹션 -->
  ${issue.week_signals ? signalSection(issue.week_signals) : ""}
  ${issue.case_of_week ? caseSection(issue.case_of_week) : ""}
  ${issue.ai_brief ? actionSection(issue.ai_brief) : ""}

  <!-- CTA -->
  <tr><td style="background:#ffffff;padding:28px 32px 36px;text-align:center;">
    <a href="https://marklens.site/insights"
      style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 36px;border-radius:100px;${F}">
      마케팅 인사이트 더 보기 →
    </a>
  </td></tr>

  <!-- 푸터 -->
  <tr><td style="background:#e8e5e0;border-radius:0 0 16px 16px;border-top:1px solid #d8d5d0;padding:22px 24px;text-align:center;">
    <p style="margin:0 0 3px;font-size:13px;font-weight:800;color:#0d0d0d;${F}">MarkLens</p>
    <p style="margin:0 0 12px;font-size:11px;color:#aaa;${F}">Where Marketing Trends Become Action</p>
    <p style="margin:0;font-size:11px;${F}">
      <a href="https://marklens.site" style="color:#888;text-decoration:none;">marklens.site</a>
      &nbsp;·&nbsp;
      <a href="${unsubscribeUrl}" style="color:#888;text-decoration:none;">구독 취소</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
