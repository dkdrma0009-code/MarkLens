import { createAdminClient } from "@/lib/supabase/admin"

export type ReadResult<T> = { ok: true; value: T } | { ok: false }

export function kstDayWindow(now: Date) {
  const day = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
  const start = new Date(`${day}T00:00:00+09:00`)
  return { day, start: start.toISOString(), end: new Date(start.getTime() + 86400_000).toISOString() }
}

async function count(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<ReadResult<number>> {
  try {
    const result = await query
    return result.error || result.count === null ? { ok: false } : { ok: true, value: result.count }
  } catch { return { ok: false } }
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<ReadResult<T[]>> {
  try {
    const result = await query
    return result.error || result.data === null ? { ok: false } : { ok: true, value: result.data }
  } catch { return { ok: false } }
}

export async function getOperationsOverview() {
  const db = createAdminClient()
  const now = new Date()
  const window = kstDayWindow(now)
  const articleCount = () => db.from("articles").select("id", { count: "exact", head: true })
  const unposted = () => db.from("cardnews").select("article_id", { count: "exact", head: true })
    .is("posted_at", null).or("publish_status.is.null,publish_status.neq.skipped_stale")

  const [collected, insights, sitePublished, pending, analyzing, ready, published, missingImages,
    drafts, socialPending, overdue, upcoming, latestPosted, latestDraft, latestSent] = await Promise.all([
    count(articleCount().neq("status", "term_card").gte("created_at", window.start).lt("created_at", window.end)),
    count(db.from("insights").select("id", { count: "exact", head: true }).gte("created_at", window.start).lt("created_at", window.end)),
    count(articleCount().gte("site_published_at", window.start).lt("site_published_at", window.end)),
    count(articleCount().eq("status", "pending")),
    count(articleCount().eq("status", "analyzing")),
    count(articleCount().eq("status", "ready")),
    count(articleCount().eq("status", "published")),
    count(articleCount().in("status", ["ready", "published"]).or([
      "and(image_url.is.null,fallback_image->>url.is.null)",
      "and(image_url.eq.,fallback_image->>url.is.null)",
      "and(image_url.is.null,fallback_image->>url.eq.)",
      "and(image_url.eq.,fallback_image->>url.eq.)",
    ].join(","))),
    count(db.from("newsletter_issues").select("id", { count: "exact", head: true }).eq("status", "draft").is("approved_at", null)),
    count(unposted()),
    count(unposted().lte("scheduled_at", now.toISOString())),
    rows(db.from("cardnews").select("article_id, scheduled_at").is("posted_at", null)
      .or("publish_status.is.null,publish_status.neq.skipped_stale").gt("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true }).limit(1)),
    rows(db.from("cardnews").select("article_id, posted_at").not("posted_at", "is", null)
      .order("posted_at", { ascending: false }).limit(1)),
    rows(db.from("newsletter_issues").select("id, issue_number, title, approved_at").eq("status", "draft")
      .order("issue_number", { ascending: false }).limit(1)),
    rows(db.from("newsletter_issues").select("id, issue_number, title, sent_at").eq("status", "sent")
      .order("sent_at", { ascending: false }).limit(1)),
  ])
  return { day: window.day, collected, insights, sitePublished, pending, analyzing, ready, published,
    missingImages, drafts, socialPending, overdue, upcoming, latestPosted, latestDraft, latestSent }
}
