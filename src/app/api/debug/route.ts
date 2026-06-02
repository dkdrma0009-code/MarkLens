import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createAdminClient()

  const { data, error, count } = await supabase
    .from("rss_sources")
    .select("*", { count: "exact" })

  const secret = process.env.N8N_WEBHOOK_SECRET ?? ""
  return NextResponse.json({
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    webhookSecretLen: secret.length,
    webhookSecretHex: Buffer.from(secret).toString("hex"),
    data,
    error: error?.message,
    count,
  })
}
