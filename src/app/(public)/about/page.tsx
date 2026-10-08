import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About MarkLens — Where Marketing Trends Become Action",
  description: "글로벌 마케팅의 변화를 읽고 실무와 커리어로 연결합니다. Marketing × Trend × Intelligence, MarkLens의 관점과 편집 원칙.",
}

export default function AboutPage() {
  return (
    <div className="ml-pages">
      <header className="ml-page-hero">
        <div className="ml-container">
          <p className="ml-eyebrow">MARKLENS / MARKETING × TREND × INTELLIGENCE</p>
          <h1>트렌드를 모으는 데서<br />끝나지 않습니다.</h1>
          <p className="ml-page-intro">정보는 넘치는데, “그래서 나는 뭘 해야 하지?”라는 물음은 남습니다. MarkLens는 변화의 의미를 읽고, 내 일에 적용할 관점으로 연결합니다.</p>
          <p className="ml-about-tagline">Where Marketing Trends Become Action</p>
        </div>
      </header>
      <div className="ml-container">
        <section className="ml-page-section" aria-label="MarkLens의 관점">
          {[
            ["01", "무엇을 보는가", "HubSpot, Marketing Week, Harvard Business Review 같은 글로벌 소스에서 브랜드 전략, 소비자 행동, 마케팅 기술의 변화를 읽습니다."],
            ["02", "어떻게 해석하는가", "AI가 요약·실전 적용법·마케팅 프레임워크를 분석하고, 에디터가 검토합니다. 무슨 일이 있었는지를 넘어, 왜 중요한지와 어떻게 적용할지를 묻습니다."],
            ["03", "누구를 위한 것인가", "마케팅을 공부하는 학생, 취업을 준비하는 사람, 커리어를 시작한 주니어 마케터. 최신 사례를 자기 언어와 경험으로 만들고 싶은 사람을 위해 씁니다."],
          ].map(([number, title, copy]) => <div key={number} className="ml-editorial-row"><span className="ml-index">{number}</span><h2>{title}</h2><p>{copy}</p></div>)}
        </section>
      </div>
      <section className="ml-about-lens">
        <div className="ml-container">
          <p className="ml-eyebrow">FROM TREND TO ACTION</p>
          <h2>읽은 사례가,<br />내가 말할 수 있는 경험이 되도록.</h2>
          <p>좋은 트렌드는 다음 질문으로 이어집니다. 내 브랜드라면 어떻게 적용할까? 포트폴리오에는 어떤 실험을 담을까? 면접에서 내 생각을 어떻게 설명할까? Insights에서 관점을 읽고, Career Lab에서 직접 연습하세요.</p>
          <div className="ml-about-links"><Link href="/insights">Insights 읽기 →</Link><Link href="/practice">Career Lab에서 연습하기 →</Link></div>
        </div>
      </section>
      <div className="ml-container">
        <section className="ml-page-cta">
          <div><p className="ml-eyebrow">MARKLENS WEEKLY</p><h2>한 주의 변화를, 하나의 관점으로.</h2><p>한 주제를 깊게 읽고, 실무와 커리어로 연결하는 무료 브리핑.</p></div>
          <Link href="/newsletter" className="ml-button ml-button-blue">Weekly 구독하기 →</Link>
        </section>
        <section className="ml-page-cta">
          <div><h2>함께 관점을 다듬어갑니다.</h2><p>불편한 점, 아쉬운 점, 바라는 점. 어떤 의견이든 환영합니다.</p></div>
          <Link href="/feedback" className="ml-text-link">피드백 남기기 →</Link>
        </section>
      </div>
    </div>
  )
}
