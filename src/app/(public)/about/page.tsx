import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "소개 | MarkLens",
  description: "MarkLens는 글로벌 마케팅 트렌드를 실무와 포트폴리오에 연결하는 마케팅 인사이트 뉴스레터입니다.",
}

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-14 space-y-14">

      {/* Hero */}
      <section>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-3">About MarkLens</p>
        <h1 className="text-4xl font-bold tracking-tight leading-tight mb-5 text-gray-900 dark:text-gray-100">
          마케팅 트렌드를 읽고,<br />실무를 준비하다.
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
          MarkLens는 글로벌 마케팅 아티클을 AI로 분석해 실무에 바로 쓸 수 있는 인사이트로 전달합니다.
          단순한 요약이 아니라, 왜 중요한지 · 어떻게 적용할지 · 면접에서 어떻게 말할지를 함께 고민합니다.
        </p>
      </section>

      <div className="border-t border-gray-100 dark:border-gray-800" />

      {/* Why */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">왜 만들었나요</h2>
        <div className="space-y-3 text-gray-600 dark:text-gray-400 leading-[1.9]">
          <p>
            마케팅을 공부하다 보면 정보는 넘치는데 정작 내 것이 되는 건 없다는 느낌, 받아본 적 있으신가요?
            좋은 아티클은 죄다 영어로 되어 있고, 번역해서 읽어도 &ldquo;그래서 나는 뭘 해야 하지?&rdquo;라는 물음이 남습니다.
          </p>
          <p>
            MarkLens는 그 물음에 답하기 위해 만들었습니다.
            HubSpot, Marketing Week, Harvard Business Review 같은 글로벌 소스에서 신호를 골라내고,
            실무 관점에서 분석해 매주 월요일 아침에 전달합니다.
          </p>
        </div>
      </section>

      {/* Who */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">누구를 위한 뉴스레터인가요</h2>
        <div className="space-y-3">
          {[
            { icon: "📚", title: "마케팅을 공부하는 학생", desc: "글로벌 트렌드를 면접 답변에 녹여내고 싶다면" },
            { icon: "🚀", title: "취업을 준비하는 취준생", desc: "최신 사례를 인용한 '면접 한 마디'를 준비하고 싶다면" },
            { icon: "💼", title: "마케터로 커리어를 시작한 주니어", desc: "빠르게 변하는 마케팅 환경을 매주 따라가고 싶다면" },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 p-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-0.5">{item.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">어떻게 만들어지나요</h2>
        <div className="space-y-0">
          {[
            { step: "01", title: "수집", desc: "전 세계 주요 마케팅 미디어에서 아티클을 매일 자동으로 수집합니다." },
            { step: "02", title: "AI 분석", desc: "핵심 요약 · 실전 적용법 · 마케팅 프레임워크 · 포트폴리오 활용법을 AI가 추출합니다." },
            { step: "03", title: "큐레이션", desc: "에디터가 직접 검토해 이번 주 가장 의미 있는 인사이트를 선별합니다." },
            { step: "04", title: "발행", desc: "매주 월요일 7:30 AM, 뉴스레터와 웹사이트에 동시 공개됩니다." },
          ].map((item, i, arr) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="w-8 h-8 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {item.step}
                </span>
                {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-800 my-1" />}
              </div>
              <div className={`${i < arr.length - 1 ? "pb-5" : ""}`}>
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-0.5">{item.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Newsletter sections */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">뉴스레터 구성</h2>
        <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          {[
            { num: "01", name: "This Week's Signal", desc: "이번 주 마케팅판의 가장 큰 변화 하나를 깊게" },
            { num: "02", name: "Case of the Week", desc: "이번 주 가장 눈에 띈 캠페인 사례 분석" },
            { num: "03", name: "Action of the Week", desc: "오늘 30분 안에 해볼 수 있는 실전 액션" },
          ].map((item) => (
            <div key={item.num} className="flex gap-4 px-5 py-4 bg-white dark:bg-gray-900">
              <span className="text-xs font-mono text-gray-400 dark:text-gray-600 w-6 flex-shrink-0 pt-0.5">{item.num}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feedback */}
      <section className="rounded-2xl border border-gray-100 dark:border-gray-800 p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">함께 만들어가요</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            불편한 점, 아쉬운 점, 바라는 점 — 어떤 의견이든 환영합니다. 1분이면 끝나요.
          </p>
        </div>
        <Link
          href="/feedback"
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
        >
          피드백 남기기 <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* CTA */}
      <div className="rounded-2xl bg-black dark:bg-white p-8 text-center">
        <p className="text-xs font-bold text-white/50 dark:text-black/50 uppercase tracking-widest mb-2">MarkLens Weekly</p>
        <h2 className="text-2xl font-bold text-white dark:text-black mb-2">
          매주 월요일, 한 주를 시작하는<br />마케팅 브리핑
        </h2>
        <p className="text-white/60 dark:text-black/50 text-sm mb-6">무료 구독 · 언제든 취소 가능</p>
        <Link
          href="/newsletter"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white dark:bg-black text-black dark:text-white text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
        >
          무료 구독하기 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  )
}
