import { createAdminClient } from "@/lib/supabase/admin"
import { generateUnsubscribeUrl } from "@/app/api/unsubscribe/route"
import { buildNewsletterHtml } from "@/lib/newsletter/html"
import { isAdmin } from "@/lib/api-auth"
import { NextResponse } from "next/server"

export const maxDuration = 300

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
  // "me" sentinel → ADMIN_EMAIL로 치환
  const rawTest = typeof body.testEmail === "string" ? body.testEmail.trim() : null
  const testEmail = rawTest === "me" ? (process.env.ADMIN_EMAIL ?? null) : rawTest

  const supabase = createAdminClient()
  const { data: issue } = await supabase.from("newsletter_issues").select("*").eq("id", issueId).single()
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 })

  const subscribers = testEmail
    ? [{ email: testEmail }]
    : (await supabase.from("subscribers").select("email").eq("status", "active")).data
  if (!subscribers?.length) return NextResponse.json({ error: "No active subscribers" }, { status: 400 })

  // 실발송은 보내기 "전"에 호를 sent 로 선점한다(조건부 UPDATE 1회) — 재시도·중복 클릭·타임아웃 후 재요청이 전체
  // 구독자에게 같은 호를 다시 보내지 않도록. 한 통도 못 보냈을 때만 이전 상태로 되돌린다.
  if (!testEmail) {
    const now = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase.from("newsletter_issues")
      .update({ status: "sent", sent_at: now, approved_at: now })
      .eq("id", issueId).or("status.is.null,status.neq.sent")
      .select("id")
    if (claimError) return NextResponse.json({ error: `발송 상태 기록 실패: ${claimError.message}` }, { status: 500 })
    if (!claimed?.length) return NextResponse.json({ error: "이미 발송된 호입니다. 다시 보내지 않습니다." }, { status: 409 })
  }

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

  // 테스트 발송은 status 변경 안 함. 실발송이 한 통도 나가지 않았으면 선점을 풀어 다시 보낼 수 있게 한다.
  if (sent === 0 && !testEmail) {
    await supabase.from("newsletter_issues")
      .update({ status: issue.status, sent_at: issue.sent_at ?? null, approved_at: issue.approved_at ?? null })
      .eq("id", issueId)
  }

  return NextResponse.json({ success: sent > 0, sentTo: sent, test: !!testEmail, errors: errors.length ? errors : undefined })
}
