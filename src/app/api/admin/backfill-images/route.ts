import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const maxDuration = 300

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MarkLens/1.0" },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (!user || user.email?.trim().toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: articles } = await db
    .from("articles")
    .select("id, url")
    .is("image_url", null)
    .limit(50)

  if (!articles || articles.length === 0) {
    return NextResponse.json({ message: "No articles to backfill", updated: 0 })
  }

  let updated = 0
  for (const article of articles) {
    const imageUrl = await fetchOgImage(article.url)
    if (imageUrl) {
      await db.from("articles").update({ image_url: imageUrl }).eq("id", article.id)
      updated++
    }
  }

  return NextResponse.json({ success: true, checked: articles.length, updated })
}
