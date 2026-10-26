// Short, secret-free error summaries for logs, cron responses and admin alerts. Keys and prompts never leave here.
const SECRET_PATTERNS: RegExp[] = [
  /([?&]key=)[^&\s"']+/gi,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /sk-(?:ant-)?[A-Za-z0-9_-]{16,}/g,
  /(Bearer\s+)[A-Za-z0-9._-]+/gi,
  /(x-goog-api-key["':\s]+)[^"',\s}]+/gi,
]

export function redactSecrets(text: string): string {
  let out = text
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, (_match, prefix) => (typeof prefix === "string" ? `${prefix}***` : "***"))
  return out
}

/** "Gemini error 429: {json}" becomes "Gemini error 429 RESOURCE_EXHAUSTED <message>"; SDK errors keep their status. */
export function summarizeError(err: unknown, max = 200): string {
  let msg = err instanceof Error ? err.message : String(err)
  const gemini = msg.match(/^(Gemini[^:]*?)\s(\d{3}):\s(\{[\s\S]*\})$/)
  if (gemini) {
    try {
      const e = JSON.parse(gemini[3]).error
      msg = `${gemini[1]} ${gemini[2]} ${e?.status ?? ""} ${e?.message ?? ""}`
    } catch { /* keep the raw message */ }
  } else {
    const status = (err as { status?: unknown })?.status
    if (typeof status === "number" && !msg.includes(String(status))) msg = `${status} ${msg}`
  }
  return redactSecrets(msg.replace(/\s+/g, " ").trim()).slice(0, max)
}
