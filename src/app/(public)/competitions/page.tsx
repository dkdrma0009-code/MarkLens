import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import CompetitionsBrowse from "./CompetitionsBrowse"
import NewsletterInlineCta from "@/components/NewsletterInlineCta"
import type { Competition } from "@/types"

export const metadata: Metadata = {
  title: "마케팅 대외활동 — MarkLens",
  description: "마케팅·광고 취준생을 위한 대외활동·공모전을 마감 임박순으로. 직무 적합도·준비 난이도까지 큐레이션합니다.",
  alternates: { canonical: "/competitions" },
}

export const revalidate = 1800

export default async function CompetitionsPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // published만(RLS), 마감 안 지났거나 상시. 마감 임박순(deadline asc, 상시는 뒤).
  const { data } = await supabase
    .from("competitions")
    .select("*")
    .eq("status", "published")
    .or(`deadline.gte.${today},deadline.is.null`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(100)

  const items = (data ?? []) as Competition[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1 text-gray-900 dark:text-gray-100">대외활동</h1>
        <p className="text-gray-500 dark:text-gray-400">
          마케팅·광고 취준생을 위한 대외활동·공모전. 마감 임박순으로, 직무 적합도와 난이도까지.
        </p>
      </div>

      <CompetitionsBrowse items={items} />

      <div className="mt-16 max-w-xl mx-auto">
        <NewsletterInlineCta />
      </div>
    </div>
  )
}
