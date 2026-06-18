import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Supabase magic link 콜백 — PKCE code exchange
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/insight-lab"

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
