import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-16">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-6">
          About MarkLens
        </p>
        <h1 className="text-3xl font-semibold tracking-tight leading-snug mb-6">
          이번 주 마케팅을 읽고,<br />
          실무를 준비하다.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          MarkLens는 단순히 뉴스를 요약하지 않습니다.
          왜 중요한지, 실무에서는 어떻게 활용되는지,
          그리고 포트폴리오에는 어떻게 녹여낼 수 있는지를 함께 분석합니다.
        </p>
      </div>

      <div className="border-t border-border/50 pt-14 mb-14">
        <h2 className="text-sm font-semibold mb-6">MarkLens가 만들어진 이유</h2>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            마케팅을 공부하는 사람이라면 누구나 겪는 문제가 있습니다.
            좋은 아티클은 넘쳐나지만, 막상 실무에 어떻게 적용할지,
            포트폴리오에 어떻게 담을지 모르는 경우가 많습니다.
          </p>
          <p>
            MarkLens는 그 간극을 채웁니다.
            글로벌 마케팅 미디어에서 가장 중요한 인사이트를 선별하고,
            현직 마케터의 시각으로 분석하여 바로 쓸 수 있는 형태로 전달합니다.
          </p>
        </div>
      </div>

      <div className="border-t border-border/50 pt-14 mb-14">
        <h2 className="text-sm font-semibold mb-6">다루는 주제</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            "브랜딩 전략",
            "퍼포먼스 마케팅",
            "SEO & 콘텐츠",
            "소셜 미디어",
            "AI 마케팅",
            "CRM & 고객 경험",
            "소비자 심리",
            "그로스 마케팅",
          ].map((topic) => (
            <div key={topic} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              {topic}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border/50 pt-14">
        <h2 className="text-sm font-semibold mb-6">MarkLens Weekly</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          매주 월요일 오전 7:30, 한 주를 시작하는 마케팅 브리핑을 이메일로 받아보세요.
          This Week&apos;s Signals, Case of the Week, Portfolio Insight, Career Lens 등
          5가지 섹션으로 구성됩니다.
        </p>
        <Link
          href="/newsletter"
          className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity"
        >
          무료 구독하기 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
