// Shared by the publisher (server) and the Social admin (client): when a channel's publish needs a person to check.
export const STALE_PUBLISHING_MS = 15 * 60 * 1000

export function needsReview(state: string | null | undefined, claimedAt: string | null | undefined, now = Date.now()) {
  return state === "needs_review" || (state === "publishing" && !!claimedAt && now - new Date(claimedAt).getTime() >= STALE_PUBLISHING_MS)
}
