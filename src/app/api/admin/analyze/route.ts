import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const secret = process.env.N8N_WEBHOOK_SECRET
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.vercel.app"

  const res = await fetch(`${base}/api/webhooks/analyze-pending?secret=${secret}`, {
    method: "POST",
  })

  const data = await res.json()
  return NextResponse.json(data)
}
