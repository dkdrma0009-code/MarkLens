"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

// 면접 한 마디 — 복사해서 바로 쓸 수 있는 인용 카드
export default function InterviewSoundbites({ items, color }: { items: string[]; color: string }) {
  const [copied, setCopied] = useState<number | null>(null)

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(i)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      // clipboard 미지원 환경 — 무시
    }
  }

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-gray-100 dark:border-gray-800 p-6 pr-14"
          style={{ borderLeft: `4px solid ${color}`, backgroundColor: color + "08" }}
        >
          <p className="text-lg leading-[1.9] text-gray-800 dark:text-gray-200">{item}</p>
          <button
            onClick={() => copy(item, i)}
            aria-label="면접 한 마디 복사"
            className="absolute top-5 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors"
          >
            {copied === i ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      ))}
      <p className="text-sm text-gray-400">복사해서 나만의 표현으로 다듬어 쓰세요. 그대로 외우면 티가 납니다 😉</p>
    </div>
  )
}
