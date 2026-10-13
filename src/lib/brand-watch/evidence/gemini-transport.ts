import { z } from "zod"
import { BrandWatchAIError, type BrandWatchAITransport } from "./transport"

const envelopeSchema = z.looseObject({
  promptFeedback: z.looseObject({ blockReason: z.string().optional() }).optional(),
  candidates: z.array(z.looseObject({ finishReason: z.string().optional(), content: z.looseObject({ parts: z.array(z.looseObject({ text: z.string().optional(), thought: z.boolean().optional() })) }).optional() })).optional(),
})

// Explicit opt-in factory. It reads no env and performs no request until generate is called.
export function createGeminiEvidenceTransport(options: { apiKey: string; model: string; fetch?: typeof globalThis.fetch }): BrandWatchAITransport {
  const apiKey = options.apiKey.trim()
  if (!apiKey || !/^gemini-[a-z0-9.-]+$/.test(options.model)) throw new Error("Gemini transport configuration required")
  return {
    provider: "gemini", model: options.model,
    async generate(request, signal) {
      if (!Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens < 1 || request.maxOutputTokens > 4000) throw new BrandWatchAIError("PROVIDER_ERROR")
      const response = await (options.fetch ?? globalThis.fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`, {
        method: "POST", redirect: "error", signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: request.system }, { text: JSON.stringify(request.trustedContext) }] }, contents: [{ role: "user", parts: [{ text: request.sourceData }] }], generationConfig: { temperature: 0.1, candidateCount: 1, maxOutputTokens: request.maxOutputTokens, responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: request.responseSchema } } } }),
      })
      if (!response.ok) {
        // Provider payloads may contain sensitive request data; never expose or log them.
        try { await response.body?.cancel() } catch { /* Preserve the typed status failure. */ }
        throw new BrandWatchAIError(response.status === 429 ? "RATE_LIMIT" : response.status === 408 ? "TIMEOUT" : response.status >= 500 ? "NETWORK" : "PROVIDER_ERROR")
      }
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !response.body) {
        try { await response.body?.cancel() } catch { /* Preserve the typed format failure. */ }
        throw new BrandWatchAIError("MALFORMED_OUTPUT")
      }
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break
          bytes += part.value.byteLength
          if (bytes > 128000) { await reader.cancel(); throw new BrandWatchAIError("MALFORMED_OUTPUT") }
          chunks.push(part.value)
        }
      } finally { reader.releaseLock() }
      let raw: unknown
      try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new BrandWatchAIError("MALFORMED_OUTPUT") }
      const checked = envelopeSchema.safeParse(raw)
      if (!checked.success) throw new BrandWatchAIError("MALFORMED_OUTPUT")
      const candidate = checked.data.candidates?.[0], block = checked.data.promptFeedback?.blockReason
      if ((block && block !== "BLOCK_REASON_UNSPECIFIED") || ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"].includes(candidate?.finishReason ?? "")) return { kind: "refusal" }
      if (candidate?.finishReason === "MAX_TOKENS") throw new BrandWatchAIError("MALFORMED_OUTPUT")
      const text = candidate?.content?.parts.filter(part => !part.thought).map(part => part.text ?? "").join("") ?? ""
      if (!text.trim()) throw new BrandWatchAIError("MALFORMED_OUTPUT")
      return { kind: "text", text }
    },
  }
}
