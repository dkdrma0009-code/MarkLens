import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 })

  const { data: stats } = await supabase
    .from("insight_user_stats")
    .select("*")
    .eq("user_id", user.id)
    .single()

  // 최근 5개 세션 히스토리도 함께 반환
  const { data: sessions } = await supabase
    .from("insight_sessions")
    .select("id, challenge_id, xp_earned, score_observation, score_analysis, score_insight, score_strategy, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  return NextResponse.json({
    stats: stats ?? null,
    sessions: sessions ?? [],
  })
}
