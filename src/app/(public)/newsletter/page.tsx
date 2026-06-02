"use client"

import { useState } from "react"
import { toast } from "sonner"

export default function NewsletterPage() {
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
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="max-w-xl mb-16">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
          MarkLens Weekly
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mb-4">
          매주 월요일 7:30 AM<br />
          마케팅 브리핑을 받아보세요
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          글로벌 마케팅 트렌드, 실무 적용법, 포트폴리오 활용 팁까지 — 한 주를 시작하는 가장 좋은 방법입니다.
        </p>

        {subscribed ? (
          <div className="border border-border rounded-lg p-6">
            <p className="text-sm font-medium mb-1">확인 이메일을 보냈습니다.</p>
            <p className="text-xs text-muted-foreground">받은 편지함에서 구독 확인 버튼을 눌러주세요.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              required
              placeholder="이메일 주소를 입력하세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {loading ? "처리 중..." : "구독하기"}
            </button>
          </form>
        )}
      </div>

      {/* Newsletter Sections */}
      <div className="border-t border-border/50 pt-16">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-10">
          뉴스레터 구성
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              number: "01",
              title: "This Week's Signals",
              desc: "이번 주 가장 중요한 마케팅 신호 3가지. AI 검색 변화, 브랜드 전략, 소비자 행동 변화까지.",
            },
            {
              number: "02",
              title: "Case of the Week",
              desc: "이번 주 최고의 마케팅 사례 1개. 무슨 일이 있었는지, 왜 성공했는지, 숨은 전략은 무엇인지.",
            },
            {
              number: "03",
              title: "AI Marketing Brief",
              desc: "마케터가 주목해야 할 AI 관련 소식. OpenAI, Google, Meta의 변화가 마케팅에 미치는 영향.",
            },
            {
              number: "04",
              title: "Portfolio Insight ✦",
              desc: "이 사례를 포트폴리오에 어떻게 담을 수 있는지. STAR 방식 예시와 면접 답변 예시 제공.",
            },
            {
              number: "05",
              title: "Career Lens ✦",
              desc: "현직자가 주목한 역량, 추천 자격증, 추천 프로젝트, 추천 툴. 취준생을 위한 커리어 코너.",
            },
          ].map((section) => (
            <div key={section.number} className="border border-border rounded-lg p-5">
              <span className="text-xs text-muted-foreground font-mono">{section.number}</span>
              <h3 className="font-medium text-sm mt-2 mb-2">{section.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{section.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
