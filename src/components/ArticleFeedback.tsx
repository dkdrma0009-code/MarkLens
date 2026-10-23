"use client"

import { useState } from "react"
import { Heart } from "lucide-react"

// One-line reader feedback under the article. Subscribing lives in the page's single Weekly form, not here.
export default function ArticleFeedback({ insightId }: { insightId: string }) {
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [comment, setComment] = useState("")
  const [showComment, setShowComment] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function sendFeedback(rating: string, c = "") {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId, rating, comment: c }),
    })
  }

  async function handleLike() {
    if (liked) return
    setLiked(true)
    setDisliked(false)
    setShowComment(false)
    try { await sendFeedback("helpful") } catch { /* silent — feedback is best-effort */ }
  }

  function handleDislike() {
    if (disliked) return
    setDisliked(true)
    setLiked(false)
    setShowComment(true)
  }

  async function submitComment() {
    try {
      await sendFeedback("not_helpful", comment)
    } catch { /* silent */ }
    setSubmitted(true)
    setShowComment(false)
  }

  return (
    <div className="ml-feedback">
      <div className="ml-feedback-row">
        <p id="feedback-question">이 인사이트가 도움이 됐나요?</p>
        <div className="ml-feedback-buttons" role="group" aria-labelledby="feedback-question">
          <button type="button" onClick={handleLike} aria-pressed={liked}>
            <Heart aria-hidden="true" className={liked ? "is-on" : undefined} />
            도움됐어요
          </button>
          <button type="button" onClick={handleDislike} aria-pressed={disliked}>
            <span aria-hidden="true">😐</span>
            아쉬워요
          </button>
        </div>
      </div>

      {liked && <p className="ml-feedback-note" role="status">♥ 응원해주셔서 감사합니다!</p>}

      {showComment && !submitted && (
        <div className="ml-feedback-comment">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="어떤 점이 아쉬웠나요? (선택)"
            aria-label="아쉬운 점 (선택)"
            rows={3}
          />
          <button type="button" onClick={submitComment}>의견 보내기</button>
        </div>
      )}

      {submitted && <p className="ml-feedback-note" role="status">의견을 보내주셔서 감사합니다 🙏</p>}
    </div>
  )
}
