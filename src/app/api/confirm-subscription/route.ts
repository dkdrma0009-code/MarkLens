import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

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
      <p style="margin:0 0 16px;"><img src="https://marklens.site/brand/marklens-wordmark-reverse.png" alt="MarkLens" width="120" height="23" style="display:inline-block;width:120px;height:auto;border:0;"/></p>
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
        <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#164BFF;">🎁 구독 선물 — 마케팅 면접 질문 40선</p>
        <a href="https://marklens.site/api/lead-magnet/interview" style="display:inline-block;padding:12px 28px;background:#164BFF;color:#fff;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;">PDF 받기 →</a>
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

type ConfirmationResult = "confirmed" | "invalid_or_consumed" | "expired" | "failure"

function confirmationResponse(result: ConfirmationResult) {
  const messages = {
    confirmed: ["구독 확인이 완료되었습니다.", "이제 MarkLens Weekly를 받아보실 수 있습니다."],
    invalid_or_consumed: ["유효하지 않거나 이미 사용된 확인 링크입니다.", "필요하면 새 확인 메일을 요청해주세요."],
    expired: ["확인 링크가 만료되었습니다.", "새 확인 메일을 요청해주세요."],
    failure: ["구독 확인 중 문제가 발생했습니다.", "잠시 후 다시 시도해주세요."],
  }
  const [title, description] = messages[result]
  return new Response(html(title, description), {
    status: result === "confirmed" ? 200 : result === "failure" ? 500 : result === "expired" ? 410 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
    },
  })
}

// HEAD/link-scanner probes must not consume a token.
export async function HEAD() {
  return new Response(null, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } })
}

export async function GET(req: Request) {
  const limited = checkRateLimit(req, { key: "confirm-subscription", limit: 10, windowMs: 60_000 })
  if (limited) return limited
  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")
  const token = searchParams.get("token")
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !token || !/^[a-f0-9]{64}$/.test(token)) {
    return confirmationResponse("invalid_or_consumed")
  }
  try {
    const { data, error } = await createAdminClient().rpc("confirm_subscription", {
      p_email: email, p_token: token,
    })
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null
    if (error || !result || !["confirmed", "invalid_or_consumed", "expired"].includes(result.result)) {
      console.error("[confirm-subscription] transition failed")
      return confirmationResponse("failure")
    }
    if (result.result === "confirmed") await sendWelcomeEmail(email)
    return confirmationResponse(result.result)
  } catch {
    console.error("[confirm-subscription] transition failed")
    return confirmationResponse("failure")
  }
}
