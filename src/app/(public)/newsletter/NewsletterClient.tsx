"use client"

import { useState } from "react"
import { toast } from "sonner"
import { trackEvent } from "@/lib/analytics"

export default function NewsletterClient() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setMessage("")
    setFailed(false)
    trackEvent("newsletter_submit", { location: "newsletter_page" })
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "newsletter_page" }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.alreadySubscribed) {
        setMessage("이미 구독 중이에요!")
        toast.info("이미 구독 중이에요!")
        trackEvent("newsletter_already", { location: "newsletter_page" })
      } else if (data.emailFailed) {
        setFailed(true)
        setMessage("확인 메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.")
        toast.error("확인 메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.")
      } else {
        setSubscribed(true)
        toast.success("확인 이메일을 보냈습니다!")
        trackEvent("newsletter_subscribe", { location: "newsletter_page" })
      }
    } catch {
      setFailed(true)
      setMessage("오류가 발생했습니다. 다시 시도해주세요.")
      toast.error("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ml-pages ml-weekly-page">
      <header className="ml-page-hero ml-publication-hero">
        <div className="ml-container ml-publication-grid">
          <div>
            <p className="ml-eyebrow">MARKLENS WEEKLY</p>
            <h1>한 주의 변화를,<br />하나의 관점으로.</h1>
            <p className="ml-page-intro">가장 의미 있는 마케팅 주제 하나를 깊게 읽습니다. 무슨 일이 있었는지부터, 내 일과 커리어에 어떤 의미가 있는지까지.</p>
          </div>
          <div id="weekly-subscribe" className="ml-publication-form">
            <p className="ml-publication-schedule">매주 월요일 아침을 위한 브리핑<br />7:30 초안 준비 · 에디터 검토 후 발송</p>
            {subscribed ? (
              <div className="ml-confirmation" role="status">
                <h2>확인 이메일을 보냈습니다.</h2>
                <p>받은 편지함에서 구독 확인 버튼을 눌러주세요.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} aria-busy={loading}>
                <label htmlFor="weekly-email">이메일 주소</label>
                <input id="weekly-email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} aria-describedby="weekly-note" />
                <button type="submit" disabled={loading} className="ml-button ml-button-blue">{loading ? "처리 중..." : "무료로 구독하기 →"}</button>
                <p id="weekly-note" className="ml-form-note">무료 구독 · 언제든 구독을 취소할 수 있습니다.<br />구독 확인 후 마케팅 면접 질문 40선 PDF를 보내드려요.</p>
                <p className="ml-form-message" role={failed ? "alert" : "status"}>{message}</p>
              </form>
            )}
          </div>
        </div>
      </header>
      <div className="ml-container">
        <section className="ml-page-section" aria-labelledby="weekly-value">
          <h2 id="weekly-value" className="ml-eyebrow">WHAT YOU GET</h2>
          <div>
            {[
              ["01", "한 주제를 깊게 읽기", "여러 소식을 얕게 훑는 대신, 이번 주 가장 강한 캠페인이나 트렌드 하나의 배경과 맥락을 읽습니다."],
              ["02", "왜 중요한지 해석하기", "글로벌 사례가 마케터에게 어떤 변화를 요구하는지, 한국 시장에서는 어떻게 생각해볼지 짚습니다."],
              ["03", "커리어로 연결하기", "읽고 끝내지 않도록. 면접에서 말할 관점과 포트폴리오에 적용할 아이디어를 함께 가져갑니다."],
            ].map(([number, title, copy]) => <div key={number} className="ml-editorial-row"><span className="ml-index">{number}</span><h3>{title}</h3><p>{copy}</p></div>)}
          </div>
        </section>
        <section className="ml-page-section" aria-labelledby="weekly-method">
          <h2 id="weekly-method" className="ml-eyebrow">HOW MARKLENS WRITES</h2>
          <ol className="ml-writing-flow">
            {[["사건", "무슨 일이 일어났나"], ["맥락", "어떤 배경에서 나온 변화인가"], ["의미", "마케터에게 왜 중요한가"], ["커리어", "내 관점과 경험으로 어떻게 연결할까"]].map(([title, copy], i) => <li key={title}><span className="ml-index">0{i + 1}{i < 3 ? " →" : ""}</span><h3>{title}</h3><p>{copy}</p></li>)}
          </ol>
        </section>
        <section className="ml-page-cta">
          <div><h2>다음 주의 관점을 받아보세요.</h2><p>MarkLens Weekly · 한 주제, 더 깊은 이해.</p></div>
          <a href="#weekly-subscribe" className="ml-button ml-button-blue">{subscribed ? "구독 확인 안내 보기 ↑" : "무료로 구독하기 ↑"}</a>
        </section>
      </div>
    </div>
  )
}
