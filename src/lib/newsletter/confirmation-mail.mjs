/** @param {string} email @param {string} confirmUrl */
export async function sendConfirmEmail(email, confirmUrl) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY ?? "",
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
  if (!res.ok) throw new Error("Confirmation email delivery failed")
}

/** @param {string} email @param {string} token */
export function confirmationUrl(email, token) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  return `${base}/api/confirm-subscription?email=${encodeURIComponent(email)}&token=${token}`
}
