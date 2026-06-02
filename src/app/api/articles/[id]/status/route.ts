import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { status } = await req.json()

  const validStatuses = ["pending", "analyzing", "ready", "published", "rejected"]
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("articles").update({ status }).eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
