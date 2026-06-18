import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  // 오늘 날짜 기준 최신 활성 챌린지 1개
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("insight_challenges")
    .select("*")
    .eq("active", true)
    .lte("published_date", today)
    .order("published_date", { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "챌린지가 없습니다" }, { status: 404 })
  }
  return NextResponse.json(data)
}
