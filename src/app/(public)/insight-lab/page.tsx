import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import AuthGate from "./_components/AuthGate"
import InsightLabTabs from "./_components/InsightLabTabs"
import CareerRoom from "@/components/career/CareerRoom"

export const metadata: Metadata = {
  title: "인사이트 분석 — MarkLens",
  description: "마케팅 트렌드를 5단계로 분석하고 AI 피드백으로 인사이트 실력을 키우세요.",
  alternates: { canonical: "/insight-lab" },
}

export default async function InsightLabPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <CareerRoom eyebrow="01 / CREATIVE STRATEGY TRAINING" title="트렌드 너머의 기회를 찾으세요." description="관찰과 맥락 → 핵심 인사이트 → 브랜드 기회. 직접 생각하고, AI 피드백으로 한 단계 더 깊이 들어갑니다.">
      {/* 본문 — 로그인 여부에 따라 분기 */}
      {user ? (
        <InsightLabTabs />
      ) : (
        <AuthGate />
      )}
    </CareerRoom>
  )
}
