import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("insights").select("id, view_count").eq("slug", slug).single()
  if (data) {
    await supabase.from("insights").update({ view_count: (data.view_count || 0) + 1 }).eq("id", data.id)
  }
  return NextResponse.json({ ok: true })
}
