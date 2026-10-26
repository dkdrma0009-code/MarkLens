// Which pending articles an analysis call takes. Without this, an article whose analysis fails goes back to pending
// with the same created_at and is picked again and again, so the same three articles hold the queue (2026-10-25/26).
export interface CandidateRow { id: string; created_at: string; updated_at: string | null }

/** A failed attempt marks the row (updated_at moves past created_at); it waits this long before the next try. */
export const RETRY_COOLDOWN_HOURS = 20

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ids already tried in this cron run, passed as `exclude=id,id`. Anything that is not a UUID is ignored. */
export function parseExclude(value: string | null): Set<string> {
  return new Set((value ?? "").split(",").map(s => s.trim()).filter(s => UUID.test(s)).slice(0, 200))
}

export function recentlyAttempted(row: CandidateRow, now: Date): boolean {
  if (!row.updated_at) return false
  const touched = Date.parse(row.updated_at)
  return touched - Date.parse(row.created_at) > 60_000 && now.getTime() - touched < RETRY_COOLDOWN_HOURS * 3_600_000
}

/** Keeps the caller's order (newest or oldest first), skipping this run's tries and recent failures. */
export function pickCandidates<T extends CandidateRow>(rows: T[], opts: { exclude?: Set<string>; now?: Date; limit?: number } = {}): { picked: T[]; skipped: number } {
  const now = opts.now ?? new Date()
  const eligible = rows.filter(r => !opts.exclude?.has(r.id) && !recentlyAttempted(r, now))
  return { picked: eligible.slice(0, opts.limit ?? 3), skipped: rows.length - eligible.length }
}
