"use client"

import { useState } from "react"
import Link from "next/link"

const ROLES = ["마케터", "취준생", "대학생", "직장인", "기타"]
const SUBSCRIBE = [
  { value: "yes", label: "구독할게요 ✓" },
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return
    setLoading(true)
    try {
      await fetch("/api/site-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, liked, disliked, role, will_subscribe: willSubscribe }),
      })
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-6">🙏</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          피드백 감사합니다!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          소중한 의견이 MarkLens를 더 좋게 만드는 데 도움이 됩니다.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              className="w-5 h-5">
              <path d="M6 26V8l10 4 10-4v18"/>
              <circle cx="16" cy="18" r="5"/>
              <circle cx="16" cy="18" r="0.5" fill="currentColor" stroke="none"/>
            </svg>
            MarkLens
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            솔직한 피드백을 주세요
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            익명으로 제출됩니다 · 1분이면 끝나요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* 1. 별점 */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              전반적으로 어떠셨나요? <span className="text-red-400">*</span>
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  aria-label={`별점 ${n}점`}
                  aria-pressed={rating === n}
                  className="text-3xl transition-transform hover:scale-110"
                >
                  <span className={(hovered || rating) >= n ? "opacity-100" : "opacity-25"}>
                    ⭐
                  </span>
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-2 self-center text-sm text-gray-500">
                  {["", "별로예요", "아쉬워요", "괜찮아요", "좋아요", "최고예요"][rating]}
                </span>
              )}
            </div>
          </div>

          {/* 2. 좋았던 점 */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              어떤 점이 좋았나요?
            </p>
            <textarea
              value={liked}
              onChange={e => setLiked(e.target.value)}
              placeholder="콘텐츠 퀄리티, UI, 특정 기능 등..."
              rows={3}
              className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 resize-none placeholder:text-gray-400 transition-colors"
            />
          </div>

          {/* 3. 아쉬운 점 */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              불편하거나 아쉬운 점이 있었나요?
            </p>
            <textarea
              value={disliked}
              onChange={e => setDisliked(e.target.value)}
              placeholder="솔직하게 말씀해주세요. 다 반영할게요 :)"
              rows={3}
              className="w-full text-sm px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 resize-none placeholder:text-gray-400 transition-colors"
            />
          </div>

          {/* 4. 직업/관심사 */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              어떤 분이세요?
            </p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(role === r ? "" : r)}
                  aria-pressed={role === r}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    role === r
                      ? "bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 5. 구독 의향 */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              뉴스레터 구독 의향이 있으신가요?
            </p>
            <div className="flex flex-wrap gap-2">
              {SUBSCRIBE.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setWillSubscribe(willSubscribe === s.value ? "" : s.value)}
                  aria-pressed={willSubscribe === s.value}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    willSubscribe === s.value
                      ? "bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!rating || loading}
            className="w-full py-3 rounded-full bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {loading ? "제출 중..." : "피드백 보내기"}
          </button>

        </form>
      </div>
    </div>
  )
}
