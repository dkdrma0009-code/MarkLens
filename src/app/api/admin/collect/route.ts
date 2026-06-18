import { isAdmin } from "@/lib/api-auth"
import { NextResponse } from "next/server"

export const maxDuration = 300

export async function POST() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const secret = process.env.N8N_WEBHOOK_SECRET

  const res = await fetch(`${base}/api/webhooks/collect?secret=${secret}`, { method: "POST" })
  const data = await res.json()
  return NextResponse.json(data)
}
