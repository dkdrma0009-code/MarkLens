// Egress guard (R-2, R-3): the second line behind the explicit checks at each publish/mail/render/cron site. In a
// Preview deployment, outbound requests that would post (Instagram, Threads), mail (Brevo) or spend (Gemini, Claude,
// OpenAI) are refused before they leave the server, so a call site without its own check still fails closed.
// With AI_KILL_SWITCH=on, every deployment refuses paid AI hosts (public, admin and cron jobs alike).
// register() runs once per server instance before any request; otherwise production and local runs are left untouched.
export async function register() {
  const { aiKillSwitch, deployment, guardFetch } = await import("./lib/release/guard.mjs")
  const preview = deployment() === "preview"
  if (!preview && !aiKillSwitch()) return
  globalThis.fetch = guardFetch(globalThis.fetch)
  console.warn(preview
    ? "[release-guard] Preview deployment: publishing, mail, paid AI and production database access are blocked."
    : "[release-guard] AI_KILL_SWITCH=on: paid AI calls are blocked.")
}
