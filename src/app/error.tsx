"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-8xl font-bold text-gray-100 dark:text-gray-800 select-none">500</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 -mt-4 mb-3">
        문제가 발생했어요
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        일시적인 오류입니다. 잠시 후 다시 시도해주세요.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
