import type { z } from "zod"

// Shared by Evidence (evidence-v1) and Pattern (pattern-v1) requests.
export interface BrandWatchAIRequest { system: string; trustedContext: unknown; sourceData: string; responseSchema: unknown; maxOutputTokens: number }

export type FailureCode = "NETWORK" | "TIMEOUT" | "RATE_LIMIT" | "MALFORMED_OUTPUT" | "SCHEMA_FAILURE" | "SAFETY_REFUSAL" | "NO_PROVIDER" | "PROVIDER_ERROR"
export class BrandWatchAIError extends Error {
  constructor(public readonly code: FailureCode) { super(code) }
}
// Caller-owned transport: no env/key access, SDK instantiation, hidden retries or global cooldown.
// A real transport must honor AbortSignal and separate system/trustedContext/sourceData messages.
export interface BrandWatchAITransport {
  provider: string; model: string
  generate(request: BrandWatchAIRequest, signal: AbortSignal): Promise<{ kind: "text"; text: string } | { kind: "refusal" }>
}
export interface AIAttempt { provider: string; model: string; result: "SUCCESS" | FailureCode }
function classifyFailure(error: unknown): FailureCode {
  if (error instanceof BrandWatchAIError) return error.code
  if (typeof error === "object" && error !== null) {
    const status = "status" in error ? error.status : "statusCode" in error ? error.statusCode : undefined
    const code = "code" in error ? error.code : undefined
    if (status === 429 || code === "RESOURCE_EXHAUSTED") return "RATE_LIMIT"
    if (status === 408 || code === "ETIMEDOUT" || (error instanceof Error && error.name === "AbortError")) return "TIMEOUT"
    if ((typeof status === "number" && status >= 500) || ["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"].includes(String(code)) || error instanceof TypeError) return "NETWORK"
  }
  return "PROVIDER_ERROR"
}
export async function runStructuredAI<T>(request: BrandWatchAIRequest, schema: z.ZodType<T>, providers: readonly BrandWatchAITransport[], options: { maxAttempts?: number; timeoutMs?: number } = {}) {
  const maxAttempts = options.maxAttempts ?? 2, timeoutMs = options.timeoutMs ?? 20000
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error("Invalid AI policy")
  const attempts: AIAttempt[] = []
  for (const provider of providers.slice(0, maxAttempts)) {
    if (!provider.provider.trim() || !provider.model.trim()) throw new Error("Transport identity required")
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const deadline = new Promise<never>((resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new BrandWatchAIError("TIMEOUT")) }, timeoutMs) })
      const result = await Promise.race([provider.generate(request, controller.signal), deadline])
      if (result.kind === "refusal") throw new BrandWatchAIError("SAFETY_REFUSAL")
      if (Buffer.byteLength(result.text, "utf8") > 24000) throw new BrandWatchAIError("MALFORMED_OUTPUT")
      let parsed: unknown
      try { parsed = JSON.parse(result.text) } catch { throw new BrandWatchAIError("MALFORMED_OUTPUT") }
      const validated = schema.safeParse(parsed)
      if (!validated.success) throw new BrandWatchAIError("SCHEMA_FAILURE")
      attempts.push({ provider: provider.provider, model: provider.model, result: "SUCCESS" })
      return { ok: true as const, data: validated.data, provider: provider.provider, model: provider.model, attempts }
    } catch (error) {
      const code = classifyFailure(error)
      attempts.push({ provider: provider.provider, model: provider.model, result: code })
      // 429, malformed/schema failures and refusal never trigger another billed attempt.
      if (!["NETWORK", "TIMEOUT"].includes(code)) return { ok: false as const, error: code, attempts }
    } finally { if (timer) clearTimeout(timer) }
  }
  const last = attempts.at(-1)?.result
  return { ok: false as const, error: last && last !== "SUCCESS" ? last : "NO_PROVIDER", attempts }
}
