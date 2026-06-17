import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendAdminAlert } from "@/lib/alert"
import { checkRateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { key: "insight-feedback", limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const { insightId, rating, comment } = await req.json()
  if (!insightId || !["helpful", "not_helpful"].includes(rating)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from("feedback").insert({
    insight_id: insightId,
    rating,
    comment: comment ? String(comment).slice(0, 1000) : null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 코멘트가 있을 때만 어드민 알림 (단순 좋아요/싫어요는 알림 제외)
  if (comment) {
    const sb = createAdminClient()
    const { data: insight } = await sb
      .from("insights")
      .select("hook, slug, article:articles!inner(title)")
      .eq("id", insightId)
      .single()
    const title = (insight as { hook?: string; slug: string; article?: { title?: string } } | null)?.hook
      ?? (insight as { article?: { title?: string } } | null)?.article?.title
      ?? insightId
    const emoji = rating === "helpful" ? "👍" : "👎"
    sendAdminAlert(
      `피드백 도착 ${emoji}`,
      `인사이트: ${title}\n평가: ${rating === "helpful" ? "도움됨" : "도움 안됨"}\n코멘트: ${comment}`
    ).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
