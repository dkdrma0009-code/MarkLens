import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// send/route.ts의 buildNewsletterHtml 로직 재사용
function buildSection(num: string, title: string, content: string, bgColor = "#fff", accentColor = "#4f46e5"): string {
  return `<tr><td style="padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};border-radius:8px;border:1px solid #e8e8e4;overflow:hidden;">
    <tr><td style="padding:20px 24px 16px;border-bottom:1px solid #e8e8e4;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accentColor};">${num} /</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:800;color:#0a0a0a;letter-spacing:-0.3px;">${title}</p>
    </td></tr>
    <tr><td style="padding:20px 24px;">
      <p style="margin:0;font-size:14px;color:#333;line-height:1.85;white-space:pre-wrap;">${content}</p>
    </td></tr>
    </table>
  </td></tr>`
}

function buildSectionWithImage(num: string, title: string, content: string, imageUrl?: string): string {
  return `<tr><td style="padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e8e8e4;overflow:hidden;">
    <tr><td style="padding:20px 24px 16px;border-bottom:1px solid #e8e8e4;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4f46e5;">${num} /</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:800;color:#0a0a0a;letter-spacing:-0.3px;">${title}</p>
    </td></tr>
    ${imageUrl ? `<tr><td style="padding:0;"><img src="${imageUrl}" alt="" width="600" style="width:100%;display:block;object-fit:cover;height:220px;"/></td></tr>` : ""}
    <tr><td style="padding:20px 24px;">
      <p style="margin:0;font-size:14px;color:#333;line-height:1.85;white-space:pre-wrap;">${content}</p>
    </td></tr>
    </table>
  </td></tr>`
}

function buildHtml(issue: any, heroImg?: string, caseImg?: string): string {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f0;">
<tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">

  <tr><td style="background:#0a0a0a;padding:32px 40px 28px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#666;letter-spacing:0.15em;text-transform:uppercase;">MarkLens Weekly</p>
    <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">${issue.title}</h1>
    <p style="margin:10px 0 0;font-size:12px;color:#666;">${today}</p>
  </td></tr>

  <tr><td style="height:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed,#ec4899);"></td></tr>

  <tr><td style="padding:28px 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f6;border-radius:8px;border:1px solid #e8e8e4;">
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#999;letter-spacing:0.12em;text-transform:uppercase;">이번 호 목차</p>
      ${["01 / This Week's Signals","02 / Case of the Week","03 / AI Marketing Brief","04 / Portfolio Insight ✦","05 / Career Lens ✦"]
        .map((item, i) => `<p style="margin:0 0 6px;font-size:13px;color:#333;font-weight:${i<2?"600":"400"};"><span style="color:#999;margin-right:4px;">${item.split("/")[0]}/</span>${item.split("/")[1]}</p>`).join("")}
    </td></tr></table>
  </td></tr>

  ${heroImg ? `<tr><td style="padding:0 40px 24px;"><img src="${heroImg}" alt="" width="520" style="width:100%;max-width:520px;border-radius:8px;display:block;object-fit:cover;height:260px;"/></td></tr>` : ""}

  ${issue.week_signals ? buildSection("01","This Week's Signals",issue.week_signals) : ""}
  ${issue.case_of_week ? buildSectionWithImage("02","Case of the Week",issue.case_of_week,caseImg) : ""}
  ${issue.ai_brief ? buildSection("03","AI Marketing Brief",issue.ai_brief) : ""}
  ${issue.portfolio_insight ? buildSection("04","Portfolio Insight ✦",issue.portfolio_insight,"#faf5ff","#7c3aed") : ""}
  ${issue.career_lens ? buildSection("05","Career Lens ✦",issue.career_lens,"#f0fdf4","#16a34a") : ""}

  <tr><td style="padding:8px 40px 32px;text-align:center;">
    <a href="https://marklens.site/insights" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:14px 32px;border-radius:100px;">마케팅 인사이트 더 보기 →</a>
  </td></tr>

  <tr><td style="height:1px;background:#e8e8e4;"></td></tr>
  <tr><td style="padding:28px 40px;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0a0a0a;">MarkLens</p>
    <p style="margin:0 0 16px;font-size:11px;color:#999;">Where Marketing Trends Become Action</p>
    <p style="margin:0;font-size:11px;color:#bbb;"><a href="https://marklens.site" style="color:#999;text-decoration:none;">marklens.site</a> · <span style="color:#bbb;">구독 취소</span></p>
  </td></tr>

</table></td></tr></table>
</body></html>`
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const issueId = searchParams.get("id")
  if (!issueId) return new Response("id required", { status: 400 })

  const db = createAdminClient()
  const { data: issue } = await db.from("newsletter_issues").select("*").eq("id", issueId).single()
  if (!issue) return new Response("Not found", { status: 404 })

  // 이미지 가져오기
  const { data: imgs } = await db
    .from("insights")
    .select("article:articles!inner(image_url)")
    .eq("articles.status", "published")
    .not("articles.image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(2)

  const images = (imgs ?? []).map((i: any) => i.article?.image_url).filter(Boolean)
  const html = buildHtml(issue, images[0], images[1])

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
