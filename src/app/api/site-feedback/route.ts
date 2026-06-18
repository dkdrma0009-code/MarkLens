import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { isAdmin } from "@/lib/api-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  // 폼 제출 어뷰징 방지 — IP당 분당 5회
  const limited = checkRateLimit(req, { key: "site-feedback", limit: 5, windowMs: 60_000 })
  if (limited) return limited

  const body = await req.json()
  const { rating, liked, disliked, role, will_subscribe } = body

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating required" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("site_feedback").insert({
    rating,
    liked: liked || null,
    disliked: disliked || null,
    role: role || null,
    will_subscribe: will_subscribe || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("site_feedback")
    .select("*")
    .order("created_at", { ascending: false })
  return NextResponse.json({ data })
}
