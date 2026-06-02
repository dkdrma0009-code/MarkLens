import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { Resend } from "resend"
import { NextResponse } from "next/server"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

export async function POST(req: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { issueId } = await req.json()
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 })

  const supabase = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: issue } = await supabase
    .from("newsletter_issues")
    .select("*")
    .eq("id", issueId)
    .single()

  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 })

  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("email")
    .eq("status", "active")

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ error: "No active subscribers" }, { status: 400 })
  }

  const html = buildNewsletterHtml(issue)
  const subject = `MarkLens Weekly ${issue.title}`
  const emails = subscribers.map((s) => s.email)

  // resend.batch.send: 개별 발송 (수신자끼리 이메일 주소 미노출), 최대 100건/호출
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map((to) => ({
      from: "MarkLens <newsletter@marklens.co>",
      to,
      subject,
      html,
    }))
    await resend.batch.send(batch)
  }

  await supabase
    .from("newsletter_issues")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", issueId)

  return NextResponse.json({ success: true, sentTo: emails.length })
}

function buildNewsletterHtml(issue: any): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MarkLens Weekly ${issue.title}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px 32px;">

    <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e5e5e5;">
      <p style="font-size:12px;color:#999;margin:0 0 8px;">MarkLens Weekly</p>
      <h1 style="font-size:22px;font-weight:600;color:#0a0a0a;margin:0;letter-spacing:-0.3px;">${issue.title}</h1>
    </div>

    ${buildSection("01 / This Week's Signals", issue.week_signals)}
    ${buildSection("02 / Case of the Week", issue.case_of_week)}
    ${buildSection("03 / AI Marketing Brief", issue.ai_brief)}
    ${buildSection("04 / Portfolio Insight ✦", issue.portfolio_insight)}
    ${buildSection("05 / Career Lens ✦", issue.career_lens)}

    <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e5e5e5;text-align:center;">
      <p style="font-size:12px;color:#999;margin:0;">
        MarkLens — Where Marketing Trends Become Action<br/>
        <a href="{{unsubscribe_url}}" style="color:#999;">구독 취소</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildSection(title: string, content: string): string {
  if (!content) return ""
  return `
    <div style="margin-bottom:36px;">
      <p style="font-size:11px;font-weight:600;color:#999;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 12px;">${title}</p>
      <div style="font-size:14px;color:#1a1a1a;line-height:1.75;white-space:pre-wrap;">${content}</div>
    </div>`
}
