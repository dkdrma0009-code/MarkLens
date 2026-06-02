import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { email } = await req.json()

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from("subscribers")
    .upsert({ email, status: "active" }, { onConflict: "email" })

  if (error) {
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
