import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()
  const tag = searchParams.get("tag")?.trim()

  let query = supabase
    .from("insight_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (q) query = query.ilike("title", `%${q}%`)
  if (tag) query = query.contains("tags", [tag])

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id, title, observation, cause, desire, insight, opportunity, tags, category, source_label } = body

  if (!title?.trim()) return NextResponse.json({ error: "제목 필요" }, { status: 400 })

  if (id) {
    // 수정
    const { data, error } = await supabase
      .from("insight_notes")
      .update({ title, observation, cause, desire, insight, opportunity, tags: tags ?? [], category, source_label, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // 신규 생성
  const { data, error } = await supabase
    .from("insight_notes")
    .insert({ user_id: user.id, title, observation: observation ?? "", cause: cause ?? "", desire: desire ?? "", insight: insight ?? "", opportunity: opportunity ?? "", tags: tags ?? [], category: category ?? "", source_label: source_label ?? "" })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 })

  const { error } = await supabase.from("insight_notes").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
