import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, slug, rss_url, website_url } = await req.json()
  if (!name || !slug || !rss_url || !website_url) {
    return NextResponse.json({ error: "모든 필드를 입력해주세요" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("rss_sources").insert({
    name, slug, rss_url, website_url, is_active: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from("rss_sources").update({ is_active }).eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
