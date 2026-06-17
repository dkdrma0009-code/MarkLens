import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase()
  const userEmail = (user?.email ?? "").trim().toLowerCase()

  if (!user || userEmail !== adminEmail) {
    redirect("/login")
  }

  return user
}
