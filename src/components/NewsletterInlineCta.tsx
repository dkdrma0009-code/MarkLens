"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { trackEvent } from "@/lib/analytics"

// 인사이트 본문 하단/중간 등에 삽입하는 구독 CTA (따뜻한 리드 전환)
// location: 폼의 논리적 위치(home_inline, insight_bottom, insight_mid 등) — 기존 값 유지.
// position: 전환율 비교용 위치 식별자(inline-bottom / inline-mid …). 미지정 시 location 에서 유도.
// variant : "card"(기본, 하단·홈 그대로) / "inline"(본문 중간용 얇은 배너).
const POSITION: Record<string, string> = {
  insight_bottom: "inline-bottom",
  insight_mid: "inline-mid",
  home_inline: "home",
  newsletter_page: "newsletter-page",
}

export default function NewsletterInlineCta({
  location = "unknown",
  position,
  variant = "card",
}: {
  location?: string
  position?: string
  variant?: "card" | "inline"
}) {
  const pos = position ?? POSITION[location] ?? location
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // 노출(impression) — 페이지 로드가 아니라 폼이 실제 뷰포트에 들어왔을 때 1회만.
  const rootRef = useRef<HTMLDivElement>(null)
  const viewed = useRef(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !viewed.current) {
            viewed.current = true
            trackEvent("newsletter_view", { location, position: pos })
            io.disconnect()
          }
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [location, pos])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    trackEvent("newsletter_submit", { location, position: pos })
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: location }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      if (data.alreadySubscribed) { toast.info("이미 구독 중이에요!"); trackEvent("newsletter_already", { location, position: pos }) }
      else if (data.emailFailed) toast.error("확인 메일 발송에 실패했어요. 잠시 후 다시 시도해주세요.")
      else { setDone(true); toast.success("확인 이메일을 보냈어요!"); trackEvent("newsletter_subscribe", { location, position: pos }) }
    } catch {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  const field = (
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
  )

  // 본문 중간용 — 얇은 인라인 배너(본문 흐름 방해 최소, 팝업 아님). 읽던 맥락에 자연스러운 문구.
  if (variant === "inline") {
    return (
      <div
        ref={rootRef}
        className="rounded-xl border border-gray-100 dark:border-gray-800 border-l-4 border-l-indigo-500 bg-gray-50/80 dark:bg-gray-900 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            이 글이 유용했다면, 매주 이런 마케팅 인사이트를 받아보세요
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            월요일 아침 7:30 브리핑 · 구독 시 「마케팅 면접 질문 40선」 PDF
          </p>
        </div>
        {done ? (
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 sm:whitespace-nowrap">확인 이메일을 보냈어요 ✓</p>
        ) : (
          <div className="sm:w-72 w-full">{field}</div>
        )}
      </div>
    )
  }

  // 기본 카드(하단·홈) — 기존 그대로.
  return (
    <div ref={rootRef} className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-6">
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">📬 구독하면 「마케팅 면접 질문 40선」 PDF 드려요</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 leading-relaxed">
        매주 월요일 7:30 AM 마케팅 브리핑 + 지금 구독 시 면접 질문 모음 PDF를 보내드립니다.
      </p>
      {done ? (
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          확인 이메일을 보냈어요 — 받은 편지함에서 구독 확인 버튼을 눌러주세요.
        </p>
      ) : (
        field
      )}
    </div>
  )
}
