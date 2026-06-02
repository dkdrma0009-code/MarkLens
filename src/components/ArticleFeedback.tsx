"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"

export default function ArticleFeedback({ insightId, color }: { insightId: string; color: string }) {
  const [rating, setRating] = useState<"helpful" | "not_helpful" | null>(null)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)

  async function submit(r: "helpful" | "not_helpful") {
    setRating(r)
    if (r === "helpful") {
      await sendFeedback(r, "")
      setSubmitted(true)
    }
  }

  async function sendFeedback(r: string, c: string) {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId, rating: r, comment: c }),
    })
  }

  async function submitComment() {
    await sendFeedback(rating!, comment)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-gray-100 p-6 text-center">
        <p className="text-lg font-semibold text-gray-900 mb-1">피드백 감사합니다 🙏</p>
        <p className="text-sm text-gray-500">더 좋은 인사이트를 만드는 데 활용할게요.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 p-6">
      <p className="text-lg font-semibold text-gray-900 mb-4 text-center">이 인사이트가 도움이 됐나요?</p>
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => submit("helpful")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-semibold transition-all ${
            rating === "helpful" ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:border-gray-400"
          }`}
          style={rating === "helpful" ? { backgroundColor: color } : {}}
        >
          <ThumbsUp className="w-4 h-4" /> 도움됐어요
        </button>
        <button
          onClick={() => submit("not_helpful")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-semibold transition-all ${
            rating === "not_helpful" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"
          }`}
        >
          <ThumbsDown className="w-4 h-4" /> 아쉬워요
        </button>
      </div>

      {rating === "not_helpful" && !submitted && (
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="어떤 점이 아쉬웠나요? (선택)"
            className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 resize-none"
            rows={3}
          />
          <button
            onClick={submitComment}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            제출하기
          </button>
        </div>
      )}
    </div>
  )
}
