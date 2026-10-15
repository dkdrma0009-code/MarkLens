import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { getAdminEmail } from "@/lib/api-auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { adminActor, handleAdminReviewRequest } from "@/lib/brand-watch/admin/actions"
import { revalidateBrandWatchPublic, type RevalidationQueryClient } from "@/lib/brand-watch/admin/revalidate"
import type { ReviewRpcClient } from "@/lib/brand-watch/review/commands"

// Admin-only Brand Watch review commands. The service-role client is created here, server-side only.
// A successful public-impacting command revalidates only /brands and the affected brand page.
export async function POST(request: Request) {
  const email = await getAdminEmail()
  let body: unknown = null
  try { body = await request.json() } catch { /* Invalid JSON is rejected as INVALID_COMMAND. */ }
  const response = await handleAdminReviewRequest(body, {
    actor: email ? adminActor(email) : null,
    client: () => createAdminClient() as unknown as ReviewRpcClient,
    onSuccess: command => revalidateBrandWatchPublic(createAdminClient() as unknown as RevalidationQueryClient, command, path => revalidatePath(path)),
  })
  return NextResponse.json(response.body, { status: response.status })
}
