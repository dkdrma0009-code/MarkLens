// cron 실패 시 어드민 이메일 알림 — Brevo transactional API 재사용
export async function sendAdminAlert(subject: string, message: string): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  const apiKey = process.env.BREVO_API_KEY
  if (!adminEmail || !apiKey) return

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "MarkLens 시스템", email: "newsletter@marklens.site" },
      to: [{ email: adminEmail }],
      subject: `[MarkLens 알림] ${subject}`,
      htmlContent: `<pre style="font-family:monospace;font-size:14px">${message}</pre>`,
    }),
  }).catch(e => console.error("[alert] 이메일 발송 실패:", e))
}
