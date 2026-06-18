import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Supabase magic link 콜백 — PKCE code exchange
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/insight-lab"

  // next는 반드시 상대경로여야 함 (open redirect 방지)
  const safePath = next.startsWith("/") && !next.startsWith("//") ? next : "/insight-lab"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/insight-lab?auth_error=1`)
  }

  return NextResponse.redirect(`${origin}${safePath}`)
}
