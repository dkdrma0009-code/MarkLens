import { NextResponse } from "next/server"
import { getAdminEmail } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { adminActor, handleAdminReviewRequest } from "@/lib/brand-watch/admin/actions"
import type { ReviewRpcClient } from "@/lib/brand-watch/review/commands"

// Admin-only Brand Watch review commands. The service-role client is created here, server-side only.
export async function POST(request: Request) {
  const email = await getAdminEmail()
  let body: unknown = null
  try { body = await request.json() } catch { /* Invalid JSON is rejected as INVALID_COMMAND. */ }
  const response = await handleAdminReviewRequest(body, { actor: email ? adminActor(email) : null, client: () => createAdminClient() as unknown as ReviewRpcClient })
  return NextResponse.json(response.body, { status: response.status })
}
