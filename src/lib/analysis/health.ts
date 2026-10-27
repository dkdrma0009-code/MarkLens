import type { SupabaseClient } from "@supabase/supabase-js"
import { freshSourceFilter } from "@/lib/content/auto-publish"

// Analysis pipeline checks shared by the collect cron and the admin health panel. Both work from the database alone,
// so they still speak when the analysis call never answers (timeout, crash) — the case no per-run alert can see.

/** A row left in "analyzing" this long was abandoned (the webhook's limit is 300s); nothing else ever resets it. */
export const STUCK_ANALYZING_MS = 60 * 60 * 1000
/** No new insight in this window while analysable articles wait means the pipeline has stalled. */
export const STALL_WINDOW_MS = 48 * 3600 * 1000

/** Moves abandoned "analyzing" rows back to pending; returns how many. */
export async function recoverStuckAnalyzing(db: SupabaseClient, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_ANALYZING_MS).toISOString()
  const { data, error } = await db.from("articles").update({ status: "pending" }).eq("status", "analyzing").lt("updated_at", cutoff).select("id")
  if (error) throw new Error(`analyzing 복구: ${error.message}`)
  return data?.length ?? 0
}

export interface AnalysisStall { stalled: boolean; freshPending: number; recentInsights: number; latestInsightAt: string | null }

export async function analysisStall(db: SupabaseClient, now = new Date()): Promise<AnalysisStall> {
  const since = new Date(now.getTime() - STALL_WINDOW_MS).toISOString()
  const [pending, recent, latest] = await Promise.all([
    db.from("articles").select("id", { count: "exact", head: true }).eq("status", "pending").or(freshSourceFilter(now)),
    db.from("insights").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("insights").select("created_at").order("created_at", { ascending: false }).limit(1),
  ])
  if (pending.error || recent.error || latest.error) throw new Error("분석 상태 조회 실패")
  const freshPending = pending.count ?? 0, recentInsights = recent.count ?? 0
  const latestInsightAt = (latest.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null
  return { stalled: freshPending > 0 && recentInsights === 0, freshPending, recentInsights, latestInsightAt }
}
