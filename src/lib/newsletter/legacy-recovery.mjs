import { randomBytes } from "node:crypto"
import { confirmationUrl, sendConfirmEmail } from "./confirmation-mail.mjs"

function legacyCandidates(query) {
  return query.eq("status", "pending").is("confirmation_token", null)
    .is("confirmation_expires_at", null).is("confirmed_at", null)
}

/**
 * One-off runner. Return only counts; never log rows, provider errors or URLs.
 * @param {{db: import('@supabase/supabase-js').SupabaseClient, execute?: boolean,
 * expectedCount?: number, sendEmail?: typeof sendConfirmEmail}} options
 */
export async function recoverLegacyPending({ db, execute = false, expectedCount, sendEmail = sendConfirmEmail }) {
  const { count, error } = await legacyCandidates(db.from("subscribers").select("id", { count: "exact", head: true }))
  if (error || !Number.isSafeInteger(count) || count < 0) throw new Error("Recovery preflight failed")
  const summary = { candidates: count, success: 0, failure: 0, skipped: 0, retryBlocked: 0 }
  if (!execute) return summary
  if (!Number.isSafeInteger(expectedCount) || expectedCount !== count) throw new Error("Recovery count guard failed")
  if (count === 0) return summary
  const { data, error: listError } = await legacyCandidates(db.from("subscribers").select("id")).limit(count)
  if (listError || !Array.isArray(data) || data.length !== count) throw new Error("Recovery candidate list changed")
  for (const row of data) {
    const token = randomBytes(32).toString("hex")
    let claimed = false
    try {
      const { data: rows, error: claimError } = await db.rpc("recover_legacy_pending_subscription", { p_id: row.id, p_token: token })
      if (claimError || !Array.isArray(rows) || rows.length > 1) throw new Error("Recovery claim failed")
      if (rows.length === 0) { summary.skipped++; continue }
      claimed = true
      if (typeof rows[0].email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rows[0].email)) throw new Error("Recovery recipient invalid")
      await sendEmail(rows[0].email, confirmationUrl(rows[0].email, token))
      summary.success++
    } catch {
      summary.failure++
      if (claimed) {
        try {
          const { data: released, error: releaseError } = await db.rpc("release_legacy_pending_recovery", { p_id: row.id, p_token: token })
          if (releaseError || !Array.isArray(released) || released.length > 1) summary.retryBlocked++
        } catch { summary.retryBlocked++ }
      } else summary.retryBlocked++ // An RPC transport failure may have committed a claim.
    }
  }
  return summary
}
