import { blockedReason } from "@/lib/release/guard.mjs"
import { redactSecrets } from "@/lib/ai/errors"

// cron 실패 시 어드민 이메일 알림 — Brevo transactional API 재사용 (Preview 에서는 보내지 않음)
// Every way this can end without a sent mail is logged (names and status only, never the address or key): an alert
// that fails silently is how the 2026-10 outage went unnoticed.
export async function sendAdminAlert(subject: string, message: string): Promise<boolean> {
  // Trimmed like every admin check does (ADMIN_EMAIL?.trim()); a stray newline or BOM in the env value would
  // otherwise make Brevo reject the recipient.
  const adminEmail = process.env.ADMIN_EMAIL?.replace(/﻿/g, "").trim()
  const apiKey = process.env.BREVO_API_KEY?.replace(/﻿/g, "").trim()
  const blocked = blockedReason("email")
  if (!adminEmail || !apiKey || blocked) {
    console.error(`[alert] 미발송 "${subject}": ${blocked ?? `${!adminEmail ? "ADMIN_EMAIL" : "BREVO_API_KEY"} 없음`}`)
    return false
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "MarkLens 시스템", email: "newsletter@marklens.site" },
        to: [{ email: adminEmail }],
        subject: `[MarkLens 알림] ${subject}`,
        htmlContent: `<pre style="font-family:monospace;font-size:14px">${message}</pre>`,
      }),
    })
    if (res.ok) return true
    // Brevo answers { code, message } on a refused send (bad key, unverified sender, invalid recipient, quota).
    const body = await res.text().catch(() => "")
    console.error(`[alert] 이메일 발송 거부 "${subject}": Brevo ${res.status} ${maskEmails(redactSecrets(body)).slice(0, 200)}`)
  } catch (e) {
    console.error(`[alert] 이메일 발송 실패 "${subject}":`, maskEmails(redactSecrets(e instanceof Error ? e.message : String(e))))
  }
  return false
}

const maskEmails = (s: string) => s.replace(/[^\s"'<>@]+@[^\s"'<>@]+/g, "***@***")
