import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function DELETE() {
  const supabase_auth = await createClient()
  const { data: { user } } = await supabase_auth.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: rejected } = await supabase
    .from("articles")
    .select("id")
    .eq("status", "rejected")

  if (!rejected || rejected.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  const ids = rejected.map(a => a.id)

  await supabase.from("insights").delete().in("article_id", ids)
  const { error } = await supabase.from("articles").delete().in("id", ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: ids.length })
}
