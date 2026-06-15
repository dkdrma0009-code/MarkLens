import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { generateUnsubscribeUrl } from "@/app/api/unsubscribe/route"
import { buildNewsletterHtml } from "@/lib/newsletter/html"
import { NextResponse } from "next/server"

export const maxDuration = 300

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

async function sendViaBrevo(to: string, subject: string, html: string, issueId: string): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "MarkLens", email: "newsletter@marklens.site" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      tags: [`issue-${issueId}`], // 웹훅에서 오픈/클릭을 이 이슈로 연결
    }),
  })
  if (!res.ok) throw new Error(`Brevo error: ${await res.text()}`)
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get("secret")
  const isN8n = secret === process.env.N8N_WEBHOOK_SECRET
  if (!isN8n && !await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const issueId = body.issueId ?? body.issue?.id
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 })
  // testEmail 지정 시 그 주소로만 발송하고 status는 변경하지 않음 (검수용)
  const testEmail = typeof body.testEmail === "string" ? body.testEmail.trim() : null

  const supabase = createAdminClient()
  const { data: issue } = await supabase.from("newsletter_issues").select("*").eq("id", issueId).single()
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 })

  const subscribers = testEmail
    ? [{ email: testEmail }]
    : (await supabase.from("subscribers").select("email").eq("status", "active")).data
  if (!subscribers?.length) return NextResponse.json({ error: "No active subscribers" }, { status: 400 })

  const cleanTitle = issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()
  const subject = `[MarkLens] ${cleanTitle}`
  let sent = 0
  const errors: string[] = []

  // 5명씩 병렬 발송 — 대량 구독자에서도 타임아웃 여유 확보. 에러는 이메일 대신 인덱스로 기록.
  const BATCH = 5
  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(async ({ email }) => {
      const unsubscribeUrl = await generateUnsubscribeUrl(email)
      await sendViaBrevo(email, subject, buildNewsletterHtml(issue, { unsubscribeUrl }), issueId)
    }))
    results.forEach((r, j) => {
      if (r.status === "fulfilled") sent++
      else errors.push(`#${i + j}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
    })
  }

  // 테스트 발송은 status 변경 안 함 (실발송만 sent 처리)
  if (sent > 0 && !testEmail) {
    await supabase.from("newsletter_issues")
      .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", issueId)
  }

  return NextResponse.json({ success: sent > 0, sentTo: sent, test: !!testEmail, errors: errors.length ? errors : undefined })
}
