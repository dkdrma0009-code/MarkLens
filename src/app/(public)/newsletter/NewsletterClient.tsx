"use client"

import { useState } from "react"
import { toast } from "sonner"

export default function NewsletterClient() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.alreadySubscribed) {
        toast.info("이미 구독 중이에요!")
      } else if (data.emailFailed) {
        // 구독은 저장됐지만 확인 메일 발송 실패 — 재시도 안내 (subscribed 유지 안 함)
        toast.error("확인 메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.")
      } else {
        setSubscribed(true)
        toast.success("확인 이메일을 보냈습니다!")
      }
    } catch {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-14">

      {/* Header */}
      <div className="max-w-xl mb-14">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-4">
          MarkLens Weekly
        </p>
        <h1 className="text-3xl font-bold tracking-tight mb-4 text-gray-900 dark:text-gray-100">
          매주 월요일 7:30 AM<br />
          마케팅 브리핑을 받아보세요
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
          글로벌 마케팅 트렌드, 실무 적용법, 포트폴리오 활용 팁까지 — 한 주를 시작하는 가장 좋은 방법입니다.
        </p>
        <p className="inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 rounded-full px-3 py-1.5 mb-8">
          🎁 지금 구독하면 「마케팅 면접 질문 40선」 PDF 드려요
        </p>

        {subscribed ? (
          <div className="border border-gray-100 dark:border-gray-800 rounded-2xl p-6 bg-gray-50 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">확인 이메일을 보냈습니다.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">받은 편지함에서 구독 확인 버튼을 눌러주세요.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              required
              aria-label="이메일 주소"
              placeholder="이메일 주소를 입력하세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? "처리 중..." : "구독하기"}
            </button>
          </form>
        )}
      </div>

      {/* Newsletter Sections */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-14">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-8">
          뉴스레터 구성
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { number: "01", title: "This Week's Signals", desc: "이번 주 가장 중요한 마케팅 신호 3가지. AI 검색 변화, 브랜드 전략, 소비자 행동 변화까지." },
            { number: "02", title: "Case of the Week", desc: "이번 주 최고의 마케팅 사례 1개. 무슨 일이 있었는지, 왜 성공했는지, 숨은 전략은 무엇인지." },
            { number: "03", title: "AI Marketing Brief", desc: "마케터가 주목해야 할 AI 관련 소식. OpenAI, Google, Meta의 변화가 마케팅에 미치는 영향." },
            { number: "04", title: "Portfolio Insight ✦", desc: "이 사례를 포트폴리오에 어떻게 담을 수 있는지. STAR 방식 예시와 면접 답변 예시 제공." },
            { number: "05", title: "Career Lens ✦", desc: "현직자가 주목한 역량, 추천 자격증, 추천 프로젝트, 추천 툴. 취준생을 위한 커리어 코너." },
          ].map((section) => (
            <div key={section.number} className="border border-gray-100 dark:border-gray-800 rounded-2xl p-5 bg-white dark:bg-gray-900">
              <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">{section.number}</span>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mt-2 mb-1.5">{section.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{section.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
