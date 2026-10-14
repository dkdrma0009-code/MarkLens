// Client- and server-safe Admin constants (no server imports).
export const NEW_SOURCE_WINDOW_DAYS = 7
export const ADMIN_TABS = ["inbox", "movements", "analysis", "entities", "sources"] as const
export type AdminTab = (typeof ADMIN_TABS)[number]
export const ANALYSIS_KINDS = ["patterns", "takes", "snapshots"] as const
export type AnalysisKind = (typeof ANALYSIS_KINDS)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Untrusted URL state: anything unexpected falls back to the default view.
export function parseConsoleParams(params: Record<string, string | string[] | undefined>) {
  const one = (key: string) => { const value = params[key]; return typeof value === "string" ? value : undefined }
  const tab = ADMIN_TABS.find(value => value === one("tab")) ?? "inbox"
  const kind = ANALYSIS_KINDS.find(value => value === one("kind")) ?? "patterns"
  const brand = one("brand") && UUID.test(one("brand")!) ? one("brand")!.toLowerCase() : "all"
  const id = one("id") && UUID.test(one("id")!) ? one("id")!.toLowerCase() : null
  return { tab, kind, brand, id }
}
