import { createClient } from "@/lib/supabase/server"

// API 라우트 공용 어드민 인증 — 18개 라우트에 복사돼 있던 동일 로직을 단일화.
// 페이지 레벨 requireAdmin()(src/lib/auth.ts)은 redirect()를 호출해 API 라우트에 부적합.
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}
