import type { Metadata } from "next"
import Link from "next/link"
import "@/components/career/career.css"

export const metadata: Metadata = {
  title: "Career Lab — MarkLens",
  description: "읽은 마케팅 트렌드를 분석·퀴즈·면접으로 연결하고, 내 사고력과 실전 역량으로 바꾸세요.",
  alternates: { canonical: "/practice" },
}

const TRACKS = [
  { number: "01", label: "INSIGHT LAB", title: "생각하는 힘", description: "트렌드의 표면에서 한 걸음 더. 관찰과 맥락을 읽고, 나만의 인사이트와 브랜드 기회를 도출하세요.", href: "/insight-lab", cta: "인사이트 훈련 시작", words: ["OBSERVE", "INTERPRET", "REIMAGINE"], note: "관찰 → 인사이트 → 브랜드 기회" },
  { number: "02", label: "AI INTERVIEW", title: "말하는 힘", description: "읽고 생각한 것을 내 언어로. 최신 마케팅 이슈와 지원 경험을 바탕으로 답변하고, AI 피드백으로 다듬으세요.", href: "/interview", cta: "면접 연습 시작", words: ["YOUR THINKING.", "YOUR VOICE."], note: "질문 → 답변 → 피드백", secondary: true },
  { number: "03", label: "TREND QUIZ", title: "기억하는 힘", description: "스쳐 지나간 트렌드를 오래 남는 지식으로. 핵심 개념을 테스트하고, 해설로 이해의 빈틈을 채우세요.", href: "/learn", cta: "트렌드 퀴즈 시작", words: ["READ IT.", "RECALL IT."], note: "선택 → 확인 → 이해" },
]
const LOOP = [
  { label: "READ", title: "최신 Insight 읽기", href: "/insights" },
  { label: "THINK", title: "Insight Lab", href: "/insight-lab" },
  { label: "TEST", title: "Trend Quiz", href: "/learn" },
  { label: "SPEAK", title: "AI Interview", href: "/interview" },
]

export default function PracticePage() {
  return (
    <div className="ml-career ml-career-landing">
      <header className="ml-career-hero ml-container">
        <p className="ml-eyebrow">MARKLENS CAREER LAB</p>
        <h1>읽은 트렌드를,<br />내 실력으로 바꾸세요<span>.</span></h1>
        <div className="ml-career-hero-bottom">
          <p>마케팅 인사이트를 분석하고, 테스트하고, 말해보세요.<br />읽는 데서 끝나지 않는 실전 사고 훈련.</p>
          <a href="#training-tracks" className="ml-text-link">나의 훈련 찾기 ↘</a>
        </div>
      </header>
      <div id="training-tracks" className="ml-container">
        {TRACKS.map(track => (
          <section key={track.number} className={`ml-career-track ${track.secondary ? "ml-career-track-reverse" : ""}`}>
            <div className="ml-career-track-copy">
              <p className="ml-eyebrow"><span>{track.number}</span> {track.label}</p>
              <h2>{track.title}</h2>
              <p>{track.description}</p>
              <Link href={track.href} className="ml-button ml-button-blue">{track.cta} ↗</Link>
              {track.secondary && <Link href="/interview/prep" className="ml-text-link">내 경험으로 맞춤 질문 준비 →</Link>}
            </div>
            <div className={`ml-career-visual ml-career-visual-${track.number}`} aria-hidden="true">
              <span className="ml-career-visual-label">TRAINING / {track.number}</span>
              <div>{track.words.map(word => <p key={word}>{word}</p>)}</div>
              <span className="ml-career-visual-note">{track.note}</span>
            </div>
          </section>
        ))}
      </div>
      <section className="ml-career-loop">
        <div className="ml-container">
          <p className="ml-eyebrow">04 / PRACTICE LOOP</p>
          <h2>인사이트가 실력이 되는 흐름.</h2>
          <p>하나의 트렌드에서 시작해, 나의 생각과 답변까지.</p>
          <div className="ml-career-loop-links">{LOOP.map((item, index) => (
            <Link key={item.href} href={item.href}><span>0{index + 1} / {item.label} <b>↗</b></span><strong>{item.title}</strong></Link>
          ))}</div>
        </div>
      </section>
    </div>
  )
}
