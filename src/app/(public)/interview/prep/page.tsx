import PrepInterviewClient from "@/components/PrepInterviewClient"
import CareerRoom from "@/components/career/CareerRoom"
import { aiPaused } from "@/lib/ai/budget"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "맞춤 면접 준비 — MarkLens",
  description: "자기소개서와 채용공고를 바탕으로 맞춤 면접 질문을 준비해요. AI 기능이 켜져 있을 때 이용할 수 있어요.",
}

export default function PrepInterviewPage() {
  return (
    <CareerRoom eyebrow="02 / AI INTERVIEW" title="내 경험에서 시작하는 면접." description="지원 직무와 경험을 정리하세요. 자기소개서와 채용공고를 바탕으로 맞춤 질문을 준비합니다.">
      {aiPaused() && (
        <div role="note" className="ml-career-ai-off">
          <strong>맞춤 질문은 지금 만들 수 없어요.</strong>
          이 기능은 AI로 질문을 만드는데 AI가 꺼져 있어, 아래 내용을 입력해도 질문이 만들어지지 않아요. 일반 면접 연습은 질문, 답변 기록, 녹화까지 그대로 이용할 수 있어요.
          <Link href="/interview" className="ml-button ml-button-blue">일반 면접 연습하기 ↗</Link>
        </div>
      )}
      <p className="ml-career-process">01 지원 직무 · 02 경험과 준비 내용 · 03 맞춤 질문</p>
      <PrepInterviewClient />
      <Link href="/interview" className="ml-career-next">← 일반 모의면접으로 돌아가기</Link>
    </CareerRoom>
  )
}
