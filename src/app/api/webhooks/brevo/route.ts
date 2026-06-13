import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// Brevo 트랜잭션 이메일 이벤트 웹훅 — delivered/opened/click 등을 issue 태그로 연결해 기록
// 설정: Brevo → Transactional → Settings → Webhook에 아래 URL 등록
//   https://marklens.site/api/webhooks/brevo?secret=<N8N_WEBHOOK_SECRET>
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  const event = String(body.event ?? "")
  const email = String(body.email ?? "")
  // tags(["issue-<uuid>"]) 또는 tag 필드에서 이슈 id 추출
  const tags: string[] = Array.isArray(body.tags) ? body.tags : body.tag ? [String(body.tag)] : []
  const issueTag = tags.find(t => t.startsWith("issue-"))
  const issueId = issueTag?.slice("issue-".length)

  if (!issueId || !event || !email) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()
  const { error } = await supabase.from("newsletter_events").insert({ issue_id: issueId, email, event })
  if (error) console.warn("[brevo webhook]", error.message) // 테이블 미생성 등 — 200으로 응답해 재시도 방지

  return NextResponse.json({ ok: true })
}
