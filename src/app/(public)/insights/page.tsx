import type { Metadata } from "next"
import { Suspense } from "react"
import { createPublicClient } from "@/lib/supabase/server"
import InsightsClient from "./InsightsClient"

export const metadata: Metadata = {
  title: "인사이트 — MarkLens",
  description: "글로벌 마케팅 트렌드에서 선별한 실무 인사이트. 브랜딩·퍼포먼스·콘텐츠·AI 마케팅을 주니어 마케터 관점으로 매일 업데이트합니다.",
  alternates: { canonical: "/insights" },
}

export const revalidate = 3600

// searchParams를 서버에서 읽지 않고(읽으면 동적 강제) 전체 발행 인사이트를 한 번만 받아 캐시(ISR).
// 카테고리 필터는 클라이언트(useSearchParams)에서 처리 → 페이지 정적화 + 카테고리 전환 즉시.
export default async function InsightsPage() {
  const supabase = createPublicClient()
  const { data: insights } = await supabase
    .from("insights")
    .select("*, article:articles!inner(*)")
    .eq("articles.status", "published")
    .order("created_at", { ascending: false })
    .limit(200)

  return (
    <div className="ml-insights">
      <div className="ml-container">
      <header className="ml-feed-header">
        <p className="ml-eyebrow">MARKLENS INSIGHTS</p>
        <h1>마케팅의 변화를<br />더 깊게 읽습니다<span className="ml-blue">.</span></h1>
        <p className="ml-feed-deck">글로벌 트렌드의 맥락부터 실무에 적용할 관점까지.<br />매일 쌓이는 마케팅 인사이트를 탐색하세요.</p>
      </header>
      {/* useSearchParams를 쓰는 클라이언트 컴포넌트는 정적 렌더 시 Suspense 경계 필요 */}
      <Suspense fallback={null}>
        <InsightsClient allInsights={insights ?? []} />
      </Suspense>
      </div>
    </div>
  )
}
