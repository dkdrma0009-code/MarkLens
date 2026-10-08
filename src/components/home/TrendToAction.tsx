import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { HomeInsight } from "./data"

export default function TrendToAction({ insight }: { insight?: HomeInsight }) {
  const href = insight ? `/insights/${insight.slug}` : "/insights"
  const steps = [
    { number: "01", label: "WHAT", title: "트렌드 이해하기", copy: "사례와 변화의 맥락을 읽고, 마케팅 프레임워크로 의미를 정리합니다.", href: insight?.framework_analysis ? `${href}#framework` : href, action: "인사이트 읽기" },
    { number: "02", label: "WHY", title: "실무에 적용하기", copy: "왜 중요한지에서 멈추지 않고, 내 브랜드에 적용할 다음 행동을 찾습니다.", href: insight?.practical_applications ? `${href}#apply` : href, action: "실전 적용법 보기" },
    { number: "03", label: "ACTION", title: "커리어로 연결하기", copy: "읽은 트렌드를 나만의 관점으로. 퀴즈와 면접 연습으로 실전 감각을 쌓습니다.", href: "/practice", action: "Career Lab 시작하기" },
  ]
  return (
    <section className="ml-section ml-action" aria-labelledby="action-title" data-reveal>
      <div className="ml-container"><div className="ml-section-heading"><div><p className="ml-eyebrow">WHERE INTELLIGENCE BECOMES ACTION</p><h2 id="action-title">From Trend to Action<span className="ml-blue">.</span></h2></div><p>읽는 것에서, 해내는 것으로.</p></div>
        <div className="ml-action-steps">{steps.map(step => <article key={step.number}><div className="ml-action-label"><span>{step.number}</span><span>{step.label}</span></div><h3>{step.title}</h3><p>{step.copy}</p><Link href={step.href} className="ml-text-link">{step.action}<ArrowUpRight size={17} aria-hidden="true" /></Link></article>)}</div>
      </div>
    </section>
  )
}
