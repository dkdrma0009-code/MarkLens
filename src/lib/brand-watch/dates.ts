// Brand Watch date semantics. A YYYY-MM-DD value is a business/source-local date and passes through
// unchanged. A timestamp resolves to its calendar date in the business time zone (Asia/Seoul), so a
// report published 2026-09-15 KST stays 2026-09-15 even when the database returns it in UTC.
export const BUSINESS_TIME_ZONE = "Asia/Seoul"
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })

export function businessDate(value: string): string {
  if (DATE_ONLY.test(value)) return value
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new Error("INVALID_DATE")
  return formatter.format(new Date(time))
}

// Business-local date `days` before an instant (recency / freshness cutoffs).
export function businessDateDaysBefore(instant: string, days: number): string {
  return businessDate(new Date(Date.parse(instant) - days * 86400000).toISOString())
}
