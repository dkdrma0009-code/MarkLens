import { z } from "zod"
import { executeReviewCommand, type ReviewRpcClient } from "../review/commands"

// Admin review request handling. The browser sends a command without an actor; the actor comes only from
// the authenticated admin session, and the command executes through the existing 019/021 RPCs.
const requestSchema = z.strictObject({ command: z.record(z.string(), z.unknown()) })

export async function handleAdminReviewRequest(body: unknown, context: { actor: string | null; client: () => ReviewRpcClient }) {
  if (!context.actor) return { status: 401, body: { ok: false as const, code: "UNAUTHORIZED" } }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success || "actor" in parsed.data.command) return { status: 400, body: { ok: false as const, code: "INVALID_COMMAND" } }
  const result = await executeReviewCommand(context.client(), { ...parsed.data.command, actor: context.actor })
  if (!result.ok) return { status: result.code === "INVALID_COMMAND" ? 400 : result.code === "DATABASE_ERROR" ? 500 : 409, body: { ok: false as const, code: result.code } }
  return { status: 200, body: { ok: true as const, command: result.command, result: result.result } }
}

export const adminActor = (email: string) => `admin:${email.trim().toLowerCase()}`.slice(0, 200)
