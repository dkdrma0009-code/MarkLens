import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { key: "insight-feedback", limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const { insightId, rating, comment } = await req.json()
  // 프론트(ArticleFeedback)가 보내는 값만 허용
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

  return NextResponse.json({ success: true })
}
