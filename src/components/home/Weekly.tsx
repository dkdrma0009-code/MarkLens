import NewsletterInlineCta from "@/components/NewsletterInlineCta"

export default function Weekly() {
  return (
    <section id="subscribe" className="ml-section ml-weekly" aria-labelledby="weekly-title" data-reveal>
      <div className="ml-container ml-weekly-grid">
        <div className="ml-weekly-edition"><div className="ml-weekly-paper"><p className="ml-eyebrow">THE WEEKLY BRIEF</p><p className="ml-edition-masthead">MarkLens<span>.</span><br />Weekly</p><span className="ml-edition-rule" aria-hidden="true" /><p className="ml-edition-line">한 주제.<br />더 깊은 관점.</p><div className="ml-edition-footer"><span>사건 / 맥락 / 의미 / 커리어</span><span aria-hidden="true">↗</span></div></div></div>
        <div className="ml-weekly-body">
        <div><p className="ml-eyebrow">MARKLENS WEEKLY</p><h2 id="weekly-title">다음 주의 관점을,<br />이번 주의 인사이트로.</h2><p className="ml-weekly-copy">트렌드의 맥락부터 실무에 적용할 아이디어까지.<br />마케터를 위한 한 주의 브리핑을 받아보세요.</p></div>
        <div className="ml-weekly-subscribe"><p className="ml-weekly-schedule"><span className="ml-blue" aria-hidden="true">↗</span> 매주 월요일을 위한 브리핑</p><NewsletterInlineCta location="home_inline" variant="weekly" /><p className="ml-weekly-note">무료 · 언제든 구독 취소 가능<br />구독 확인 후 「마케팅 면접 질문 40선」 PDF를 드립니다.</p></div>
        </div>
      </div>
    </section>
  )
}
