import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { refreshIgToken } from "@/lib/instagram"
import { refreshThreadsToken } from "@/lib/threads"

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

function daysUntil(updatedAt: string | null): number | null {
  if (!updatedAt) return null
  const expiry = new Date(updatedAt).getTime() + 60 * 24 * 60 * 60 * 1000
  return Math.round((expiry - Date.now()) / 86400000)
}

// GET — 두 토큰 만료 현황 반환
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sb = createAdminClient()
  const { data: rows } = await sb
    .from("app_config")
    .select("key, updated_at")
    .in("key", ["ig_access_token", "threads_access_token"])

  const ig = rows?.find(r => r.key === "ig_access_token")
  const threads = rows?.find(r => r.key === "threads_access_token")

  return NextResponse.json({
    ig: { daysLeft: daysUntil(ig?.updated_at ?? null), lastRefreshed: ig?.updated_at ?? null },
    threads: { daysLeft: daysUntil(threads?.updated_at ?? null), lastRefreshed: threads?.updated_at ?? null },
  })
}

// POST — 수동 갱신
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { platform } = await req.json().catch(() => ({ platform: "both" }))
  const result: Record<string, unknown> = {}

  if (platform === "ig" || platform === "both") {
    try { result.igDays = await refreshIgToken() }
    catch (e) { result.igError = e instanceof Error ? e.message : String(e) }
  }
  if (platform === "threads" || platform === "both") {
    try { result.threadsDays = await refreshThreadsToken() }
    catch (e) { result.threadsError = e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(result)
}
