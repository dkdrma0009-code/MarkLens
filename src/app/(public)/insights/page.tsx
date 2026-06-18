import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import InsightsClient from "./InsightsClient"

export const metadata: Metadata = {
  title: "인사이트 — MarkLens",
  description: "글로벌 마케팅 트렌드에서 선별한 실무 인사이트. 브랜딩·퍼포먼스·콘텐츠·AI 마케팅을 주니어 마케터 관점으로 매일 업데이트합니다.",
  alternates: { canonical: "/insights" },
}

export const revalidate = 3600

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function InsightsPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .eq("articles.status", "published")
    .order("created_at", { ascending: false })
    .limit(200)

  if (category) query = query.eq("category", category)

  const { data: insights } = await query

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1 text-gray-900 dark:text-gray-100">인사이트</h1>
        <p className="text-gray-500 dark:text-gray-400">글로벌 마케팅 트렌드에서 선별한 실무 인사이트</p>
      </div>
      <InsightsClient category={category} allInsights={insights ?? []} />
    </div>
  )
}
