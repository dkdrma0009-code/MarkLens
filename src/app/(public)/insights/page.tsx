import { createClient } from "@/lib/supabase/server"
import InsightsClient from "./InsightsClient"

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
        <p className="text-gray-500 dark:text-gray-400">글로벌 마케팅 아티클에서 추출한 실무 인사이트</p>
      </div>
      <InsightsClient category={category} allInsights={insights ?? []} />
    </div>
  )
}
