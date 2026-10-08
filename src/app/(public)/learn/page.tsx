import LearnQuiz from "@/components/LearnQuiz"
import CareerRoom from "@/components/career/CareerRoom"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "마케팅 트렌드 퀴즈 — MarkLens",
  description: "이번 주 마케팅 트렌드를 얼마나 따라잡았는지 퀴즈로 테스트해보세요",
}

export default function LearnPage() {
  return (
    <CareerRoom eyebrow="03 / DAILY TREND QUIZ" title="읽은 것을, 오래 남도록." description="최근 마케팅 인사이트로 핵심 개념을 점검하세요. 정답보다 중요한 것은 해설에서 얻는 이해입니다.">
      <LearnQuiz />
    </CareerRoom>
  )
}
