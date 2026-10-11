import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import { confirmationUrl, sendConfirmEmail } from "@/lib/newsletter/confirmation-mail.mjs"

export async function POST(req: Request) {
  // 이메일 발송 비용·스팸 방지 — 정상 사용자는 1회로 충분, IP당 분당 3회
  const limited = checkRateLimit(req, { key: "subscribe", limit: 3, windowMs: 60_000 })
  if (limited) return limited

  const { email, source } = await req.json()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "유효하지 않은 이메일입니다" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Serialize signup/resend against confirmation; active rows never regress.
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "")
    const { data, error } = await supabase.rpc("issue_subscription_confirmation", {
      p_email: email, p_token: token,
      p_source: typeof source === "string" ? source.slice(0, 80) : null,
    })
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null
    if (error || !result || !["issued", "already_active"].includes(result.result)) {
      console.error("[subscribe] token issue failed")
      return NextResponse.json({ error: "구독 저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 })
    }
    if (result.result === "already_active") {
      return NextResponse.json({ success: true, alreadySubscribed: true })
    }
    const confirmUrl = confirmationUrl(email, token)

    try {
      await sendConfirmEmail(email, confirmUrl)
    } catch {
      // 이메일 발송 실패해도 구독은 유지, 재시도 안내
      return NextResponse.json({ success: true, emailFailed: true })
    }

    return NextResponse.json({ success: true, subscriptionCreated: result.subscription_created === true })
  } catch {
    console.error("[subscribe] token issue failed")
    return NextResponse.json({ error: "구독 저장에 실패했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 })
  }
}
