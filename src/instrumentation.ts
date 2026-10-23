// Preview egress guard (R-2): the second line behind the explicit checks at each publish/mail/render/cron site. In a
// Preview deployment, outbound requests that would post (Instagram, Threads), mail (Brevo) or spend (Gemini, Claude,
// OpenAI) are refused before they leave the server, so a call site without its own check still fails closed.
// register() runs once per server instance before any request; production and local runs are left untouched.
export async function register() {
  const { deployment, guardFetch } = await import("./lib/release/guard.mjs")
  if (deployment() !== "preview") return
  globalThis.fetch = guardFetch(globalThis.fetch)
  console.warn("[release-guard] Preview deployment: publishing, mail, paid AI and production DB writes are blocked.")
}
