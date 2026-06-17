import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

async function makeConfirmToken(email: string): Promise<string> {
  const secret = process.env.N8N_WEBHOOK_SECRET ?? ""
  const data = new TextEncoder().encode(`confirm:${email}:${secret}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
}

async function sendConfirmEmail(email: string, confirmUrl: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "MarkLens", email: "newsletter@marklens.site" },
      to: [{ email }],
      subject: "MarkLens 뉴스레터 구독 확인",
      htmlContent: `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,sans-serif;background:#f9f9f9;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;border:1px solid #e5e5e5;">
    <p style="font-size:12px;color:#999;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em;">MarkLens Weekly</p>
    <h1 style="font-size:22px;font-weight:700;color:#0a0a0a;margin:0 0 16px;">구독을 확인해주세요</h1>
    <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 24px;">
      아래 버튼을 클릭하면 구독이 완료됩니다.<br/>
      매주 월요일 7:30 AM, 마케팅 인사이트를 보내드립니다.
    </p>
    <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;background:#000;color:#fff;border-radius:100px;font-size:15px;font-weight:600;text-decoration:none;">
      구독 확인하기 →
    </a>
    <p style="font-size:12px;color:#aaa;margin:24px 0 0;">
      본인이 신청하지 않았다면 이 메일을 무시하세요.
    </p>
  </div>
</body>
</html>`,
    }),
  })
  if (!res.ok) throw new Error(`Brevo error: ${await res.text()}`)
}

export async function POST(req: Request) {
  const { email, source } = await req.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "유효하지 않은 이메일입니다" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 이미 active 구독자면 바로 성공 반환
  const { data: existing } = await supabase
    .from("subscribers")
    .select("status")
    .eq("email", email)
    .single()

  if (existing?.status === "active") {
    return NextResponse.json({ success: true, alreadySubscribed: true })
  }

  // pending 상태로 저장 (source는 최초 구독 시만 기록, 재구독 시 덮어쓰지 않음)
  const row: Record<string, string> = { email, status: "pending" }
  if (source && typeof source === "string") row.source = source.slice(0, 80)
  await supabase
    .from("subscribers")
    .upsert(row, { onConflict: "email" })

  // 확인 이메일 발송
  const token = await makeConfirmToken(email)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const confirmUrl = `${base}/api/confirm-subscription?email=${encodeURIComponent(email)}&token=${token}`

  try {
    await sendConfirmEmail(email, confirmUrl)
  } catch {
    // 이메일 발송 실패해도 구독은 유지, 재시도 안내
    return NextResponse.json({ success: true, emailFailed: true })
  }

  return NextResponse.json({ success: true })
}
