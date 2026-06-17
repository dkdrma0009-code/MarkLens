import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export async function GET(req: Request) {
  // 구독 취소 링크 반복 호출 방지 — IP당 분당 10회
  const limited = checkRateLimit(req, { key: "unsubscribe", limit: 10, windowMs: 60_000 })
  if (limited) return new Response("요청이 많습니다. 잠시 후 다시 시도해주세요.", {
    status: 429,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")
  const token = searchParams.get("token")

  if (!email || !token) {
    return new Response("잘못된 구독 취소 링크입니다.", { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  // 토큰 검증 (이메일 + 시크릿 해시)
  const expectedToken = await makeToken(email)
  if (token !== expectedToken) {
    return new Response("유효하지 않은 링크입니다.", { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  const supabase = createAdminClient()
  await supabase
    .from("subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("email", email)

  return new Response(unsubscribeHtml(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

async function makeToken(email: string): Promise<string> {
  const secret = process.env.N8N_WEBHOOK_SECRET ?? ""
  const data = new TextEncoder().encode(`${email}:${secret}`)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
}

export async function generateUnsubscribeUrl(email: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const token = await makeToken(email)
  return `${base}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
}

function unsubscribeHtml() {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"/><title>구독 취소 완료</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9f9f9;">
  <div style="text-align:center;padding:40px;">
    <h1 style="font-size:20px;font-weight:600;margin-bottom:8px;">구독이 취소됐습니다.</h1>
    <p style="color:#666;font-size:14px;">MarkLens Weekly 구독이 취소됐습니다.<br/>언제든지 다시 구독하실 수 있습니다.</p>
    <a href="https://marklens.vercel.app/newsletter" style="display:inline-block;margin-top:20px;font-size:13px;color:#000;">다시 구독하기 →</a>
  </div>
</body>
</html>`
}
