"use client"

import { useState } from "react"
import { toast } from "sonner"

// 인사이트 본문 하단 등에 삽입하는 컴팩트 구독 CTA (따뜻한 리드 전환)
export default function NewsletterInlineCta() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      if (data.alreadySubscribed) toast.info("이미 구독 중이에요!")
      else if (data.emailFailed) toast.error("확인 메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.")
      else { setDone(true); toast.success("확인 이메일을 보냈어요!") }
    } catch {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6">
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">📬 구독하면 「마케팅 면접 질문 44선」 PDF 드려요</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 leading-relaxed">
        매주 월요일 7:30 AM 마케팅 브리핑 + 지금 구독 시 면접 질문 모음 PDF를 보내드립니다.
      </p>
      {done ? (
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          확인 이메일을 보냈어요 — 받은 편지함에서 구독 확인 버튼을 눌러주세요.
        </p>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="email"
            required
            aria-label="이메일 주소"
            placeholder="이메일 주소"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold rounded-full bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "처리 중..." : "구독"}
          </button>
        </form>
      )}
    </div>
  )
}
