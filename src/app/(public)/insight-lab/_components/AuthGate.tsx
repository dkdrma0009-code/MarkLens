"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Mail, Sparkles } from "lucide-react"

export default function AuthGate() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError("")

    const redirectTo = `${window.location.origin}/auth/callback?next=/insight-lab`
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] px-6">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 mb-6">
          <Mail className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">이메일을 확인하세요</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          <strong>{email}</strong>로 로그인 링크를 보냈어요.
          링크를 클릭하면 바로 시작할 수 있어요.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-6">
      <div className="w-16 h-16 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950 mb-6">
        <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">인사이트 분석 시작하기</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-8">
        이메일로 로그인하면 내 분석 기록과 성장 리포트를 저장할 수 있어요.
      </p>
      <form onSubmit={sendMagicLink} className="w-full max-w-sm flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일 주소"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {loading ? "전송 중…" : "이메일 링크 받기"}
        </button>
      </form>
    </div>
  )
}
