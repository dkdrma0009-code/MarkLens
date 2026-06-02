import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { insightId, rating, comment } = await req.json()
  if (!insightId || !rating) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from("feedback").insert({ insight_id: insightId, rating, comment: comment || null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
