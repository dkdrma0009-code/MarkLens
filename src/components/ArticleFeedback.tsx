"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import Link from "next/link"

export default function ArticleFeedback({ insightId, color }: { insightId: string; color: string }) {
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [comment, setComment] = useState("")
  const [showComment, setShowComment] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [email, setEmail] = useState("")
  const [subLoading, setSubLoading] = useState(false)

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
    await sendFeedback("helpful")
  }

  async function handleDislike() {
    if (disliked) return
    setDisliked(true)
    setLiked(false)
    setShowComment(true)
  }

  async function submitComment() {
    await sendFeedback("not_helpful", comment)
    setSubmitted(true)
    setShowComment(false)
  }

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    setSubLoading(true)
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.alreadySubscribed) {
        setSubscribed(true)
      } else {
        setSubscribed(true)
      }
    } finally {
      setSubLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 좋아요 카드 */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100 text-center mb-5">
          이 인사이트가 도움이 됐나요?
        </p>

        <div className="flex justify-center gap-3 mb-4">
          {/* 좋아요 */}
          <button
            onClick={handleLike}
            className={`flex flex-col items-center gap-1.5 px-8 py-4 rounded-2xl border-2 transition-all ${
              liked
                ? "border-rose-400 bg-rose-50 dark:bg-rose-950"
                : "border-gray-100 dark:border-gray-800 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950"
            }`}
          >
            <Heart
              className={`w-6 h-6 transition-colors ${liked ? "fill-rose-500 text-rose-500" : "text-gray-300 dark:text-gray-600"}`}
            />
            <span className={`text-sm font-semibold transition-colors ${liked ? "text-rose-500" : "text-gray-400 dark:text-gray-500"}`}>
              도움됐어요
            </span>
          </button>

          {/* 아쉬워요 */}
          <button
            onClick={handleDislike}
            className={`flex flex-col items-center gap-1.5 px-8 py-4 rounded-2xl border-2 transition-all ${
              disliked
                ? "border-gray-400 bg-gray-50 dark:bg-gray-800"
                : "border-gray-100 dark:border-gray-800 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <span className={`text-2xl transition-all ${disliked ? "" : "opacity-40"}`}>😐</span>
            <span className={`text-sm font-semibold transition-colors ${disliked ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>
              아쉬워요
            </span>
          </button>
        </div>

        {/* 좋아요 후 메시지 */}
        {liked && (
          <p className="text-center text-sm text-rose-500 font-medium">
            ♥ 응원해주셔서 감사합니다!
          </p>
        )}

        {/* 아쉬워요 코멘트 */}
        {showComment && !submitted && (
          <div className="mt-4 space-y-3">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="어떤 점이 아쉬웠나요? (선택)"
              className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-gray-400 resize-none"
              rows={3}
            />
            <button
              onClick={submitComment}
              className="w-full py-2.5 text-sm font-semibold rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity"
            >
              의견 보내기
            </button>
          </div>
        )}

        {submitted && (
          <p className="text-center text-sm text-gray-500 mt-2">의견을 보내주셔서 감사합니다 🙏</p>
        )}
      </div>

      {/* 뉴스레터 구독 인라인 CTA */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: color + "10", border: `1px solid ${color}25` }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
            style={{ backgroundColor: color }}>
            ✦
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              매주 월요일, 이런 인사이트를 이메일로 받아보세요
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              무료 · 언제든 취소 가능
            </p>
          </div>
        </div>

        {subscribed ? (
          <p className="text-sm font-medium text-center" style={{ color }}>
            확인 이메일을 보냈습니다 ✓
          </p>
        ) : (
          <form onSubmit={handleSubscribe} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일 주소"
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:border-gray-400"
            />
            <button
              type="submit"
              disabled={subLoading}
              className="px-4 py-2 text-sm font-bold rounded-xl text-white disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {subLoading ? "..." : "구독"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
