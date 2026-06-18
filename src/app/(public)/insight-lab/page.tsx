import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import AuthGate from "./_components/AuthGate"
import InsightLabTabs from "./_components/InsightLabTabs"

export const metadata: Metadata = {
  title: "인사이트 분석 — MarkLens",
  description: "마케팅 트렌드를 5단계로 분석하고 AI 피드백으로 인사이트 실력을 키우세요.",
  alternates: { canonical: "/insight-lab" },
}

export default async function InsightLabPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* 헤더 */}
      <div className="mb-8">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">인사이트 분석</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          마케팅 인사이트 트레이닝
        </h1>
        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
          트렌드를 5단계로 분석하고, AI 평가로 관찰력·분석력·인사이트력·전략력을 키우세요.
        </p>
      </div>

      {/* 본문 — 로그인 여부에 따라 분기 */}
      {user ? (
        <InsightLabTabs />
      ) : (
        <AuthGate />
      )}
    </div>
  )
}
