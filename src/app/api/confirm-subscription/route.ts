import { createAdminClient } from "@/lib/supabase/admin"

async function makeConfirmToken(email: string): Promise<string> {
  const secret = process.env.N8N_WEBHOOK_SECRET ?? "marklens"
  const data = new TextEncoder().encode(`confirm:${email}:${secret}`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)
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
  await supabase
    .from("subscribers")
    .update({ status: "active", subscribed_at: new Date().toISOString() })
    .eq("email", email)

  return new Response(html("구독이 완료됐습니다! 🎉", "매주 월요일 7:30 AM, 마케팅 인사이트를 보내드립니다."), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
