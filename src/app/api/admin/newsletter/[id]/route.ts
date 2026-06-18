import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { NextResponse } from "next/server"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from("newsletter_issues").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
