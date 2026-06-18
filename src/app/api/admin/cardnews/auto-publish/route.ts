import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { NextResponse } from "next/server"

// 인스타 자동발행 스위치 ON/OFF (app_config.ig_auto_publish)
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { enabled } = await req.json().catch(() => ({}))
  const supabase = createAdminClient()
  const { error } = await supabase.from("app_config").upsert({
    key: "ig_auto_publish",
    value: enabled ? "on" : "off",
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, enabled: !!enabled })
}
