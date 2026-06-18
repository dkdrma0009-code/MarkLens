import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, summary, category, difficulty, source_name, source_url, published_date, active } = body

  if (!title?.trim() || !summary?.trim()) {
    return NextResponse.json({ error: "title과 summary 필수" }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data, error } = await sb
    .from("insight_challenges")
    .insert({ title, summary, category, difficulty, source_name, source_url: source_url || null, published_date, active })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id } = body
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 })

  const ALLOWED = ["title","summary","category","difficulty","source_name","source_url","published_date","active"] as const
  const updates = Object.fromEntries(ALLOWED.filter(k => k in body).map(k => [k, body[k]]))

  const sb = createAdminClient()
  const { data, error } = await sb
    .from("insight_challenges")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
