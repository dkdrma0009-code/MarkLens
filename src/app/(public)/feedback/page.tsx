"use client"

import { useState } from "react"
import Link from "next/link"

const ROLES = ["마케터", "취준생", "대학생", "직장인", "기타"]
const SUBSCRIBE = [
  { value: "yes", label: "구독할게요" },
  { value: "maybe", label: "고민 중" },
  { value: "no", label: "아직은 아니에요" },
]

export default function FeedbackPage() {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [liked, setLiked] = useState("")
  const [disliked, setDisliked] = useState("")
  const [role, setRole] = useState("")
  const [willSubscribe, setWillSubscribe] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!rating) { setError("전반적인 만족도를 1~5점 중 선택해주세요."); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/site-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, liked, disliked, role, will_subscribe: willSubscribe }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setError("의견을 보내지 못했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="ml-pages"><div className="ml-state ml-container" role="status"><p className="ml-eyebrow">FEEDBACK RECEIVED</p><h1>피드백 감사합니다.</h1><p>소중한 의견이 MarkLens를 더 좋게 만드는 데 도움이 됩니다.</p><div className="ml-state-actions"><Link href="/" className="ml-button ml-button-blue">홈으로 돌아가기 →</Link></div></div></div>
  )

  return (
    <div className="ml-pages">
      <div className="ml-feedback ml-container">
        <header className="ml-feedback-header">
          <p className="ml-eyebrow">Help us sharpen the lens.</p>
          <h1>MarkLens를 더 좋아지게 만드는<br />의견을 들려주세요.</h1>
          <p>익명으로 제출됩니다 · 만족도만 필수, 나머지는 선택입니다.</p>
        </header>
        <form onSubmit={handleSubmit} className="ml-feedback-form" aria-busy={loading}>
          <fieldset><legend>전반적으로 어떠셨나요? <span>(필수)</span></legend>
            <div className="ml-rating">
              {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(0)} aria-label={`별점 ${n}점`} aria-pressed={rating === n} data-filled={(hovered || rating) >= n}><span aria-hidden="true">{n}</span></button>)}
              <p role="status">{["1~5점 중 선택해주세요", "별로예요", "아쉬워요", "괜찮아요", "좋아요", "최고예요"][rating]}</p>
            </div>
          </fieldset>
          <div><label htmlFor="feedback-liked">어떤 점이 좋았나요?</label><textarea id="feedback-liked" value={liked} onChange={e => setLiked(e.target.value)} placeholder="콘텐츠, 화면, 유용했던 기능을 알려주세요." rows={3} /></div>
          <div><label htmlFor="feedback-disliked">불편하거나 아쉬운 점이 있었나요?</label><textarea id="feedback-disliked" value={disliked} onChange={e => setDisliked(e.target.value)} placeholder="개선했으면 하는 점을 편하게 남겨주세요." rows={3} /></div>
          <fieldset><legend>어떤 분이세요? <span>(선택)</span></legend><div className="ml-choices">{ROLES.map(r => <button key={r} type="button" onClick={() => setRole(role === r ? "" : r)} aria-pressed={role === r}>{r}</button>)}</div></fieldset>
          <fieldset><legend>MarkLens Weekly 구독 의향이 있으신가요? <span>(선택)</span></legend><div className="ml-choices">{SUBSCRIBE.map(s => <button key={s.value} type="button" onClick={() => setWillSubscribe(willSubscribe === s.value ? "" : s.value)} aria-pressed={willSubscribe === s.value}>{s.label}</button>)}</div></fieldset>
          <p className="ml-form-message" role="alert">{error}</p>
          <button type="submit" disabled={!rating || loading} className="ml-button ml-button-blue">{loading ? "제출 중..." : "피드백 보내기 →"}</button>
        </form>
      </div>
    </div>
  )
}
