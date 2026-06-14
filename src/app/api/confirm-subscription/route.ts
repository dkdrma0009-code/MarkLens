import { createAdminClient } from "@/lib/supabase/admin"

async function makeConfirmToken(email: string): Promise<string> {
  const secret = process.env.N8N_WEBHOOK_SECRET ?? ""
  const data = new TextEncoder().encode(`confirm:${email}:${secret}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
}

const F = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"

// 구독 확인 직후 보내는 웰컴 이메일 (첫인상 + 기대치 설정 + 사이트 유도)
async function sendWelcomeEmail(email: string): Promise<void> {
  if (!process.env.BREVO_API_KEY) return
  const welcome = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:40px 20px;background:#e8e5e0;${F}">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
    <tr><td style="background:#0d0d0d;border-radius:16px 16px 0 0;padding:36px 32px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#7a7a7a;letter-spacing:0.18em;text-transform:uppercase;">MarkLens Weekly</p>
      <h1 style="margin:0;font-size:24px;font-weight:900;color:#fff;">구독을 환영합니다 🎉</h1>
    </td></tr>
    <tr><td style="background:#fff;padding:30px 32px;">
      <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.8;">
        이제부터 <b>매주 월요일 아침 7:30</b>, 글로벌 마케팅 트렌드를 실무로 바꾸는 브리핑을 보내드려요.
      </p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111;">메일에 담기는 것</p>
      <p style="margin:0 0 4px;font-size:14px;color:#444;line-height:1.7;">📡 이번 주 핵심 시그널 3가지</p>
      <p style="margin:0 0 4px;font-size:14px;color:#444;line-height:1.7;">🔍 이번 주 최고의 마케팅 사례</p>
      <p style="margin:0 0 4px;font-size:14px;color:#444;line-height:1.7;">🎯 바로 써먹는 액션 + 포트폴리오·커리어 팁</p>
      <div style="margin-top:24px;padding:18px 20px;background:#f4f4ff;border:1px solid #e0e0ff;border-radius:12px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#4338ca;">🎁 구독 선물 — 마케팅 면접 질문 40선</p>
        <a href="https://marklens.site/api/lead-magnet/interview" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#fff;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;">PDF 받기 →</a>
      </div>
      <div style="text-align:center;margin-top:18px;">
        <a href="https://marklens.site/insights" style="display:inline-block;padding:14px 32px;background:#0d0d0d;color:#fff;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;">지금 인사이트 둘러보기 →</a>
      </div>
    </td></tr>
    <tr><td style="background:#e8e5e0;border-radius:0 0 16px 16px;border-top:1px solid #d8d5d0;padding:20px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#999;">트렌드를 실전으로 바꾸는 마크렌즈 · marklens.site</p>
    </td></tr>
  </table></td></tr></table>
</body></html>`
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "MarkLens", email: "newsletter@marklens.site" },
        to: [{ email }],
        subject: "MarkLens 구독을 환영합니다 🎉",
        htmlContent: welcome,
      }),
    })
  } catch { /* 웰컴 메일 실패는 확인 완료에 영향 없음 */ }
}

const html = (msg: string, sub: string) => `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"/><title>MarkLens</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9f9f9;">
  <div style="text-align:center;padding:40px;max-width:400px;">
    <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;">${msg}</h1>
    <p style="color:#666;font-size:15px;">${sub}</p>
    <a href="https://marklens.site" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#000;color:#fff;border-radius:100px;font-size:14px;font-weight:600;text-decoration:none;">사이트 둘러보기</a>
  </div>
</body>
</html>`

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")
  const token = searchParams.get("token")

  if (!email || !token) {
    return new Response(html("잘못된 링크입니다", "다시 구독 신청해주세요."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 400,
    })
  }

  const expected = await makeConfirmToken(email)
  if (token !== expected) {
    return new Response(html("유효하지 않은 링크입니다", "다시 구독 신청해주세요."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 400,
    })
  }

  const supabase = createAdminClient()
  const { data: existing } = await supabase.from("subscribers").select("status").eq("email", email).single()
  await supabase
    .from("subscribers")
    .update({ status: "active", subscribed_at: new Date().toISOString() })
    .eq("email", email)

  // 신규 활성화만 웰컴 메일 (재클릭 시 중복 발송 방지)
  if (existing?.status !== "active") await sendWelcomeEmail(email)

  return new Response(html("구독이 완료됐습니다! 🎉", "매주 월요일 7:30 AM, 마케팅 인사이트를 보내드립니다."), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
