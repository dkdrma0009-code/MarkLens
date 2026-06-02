import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-8xl font-bold text-gray-100 dark:text-gray-800 select-none">404</p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 -mt-4 mb-3">
        페이지를 찾을 수 없어요
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        주소가 잘못됐거나 삭제된 페이지입니다.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
        >
          홈으로
        </Link>
        <Link
          href="/insights"
          className="px-5 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          인사이트 보기
        </Link>
      </div>
    </div>
  )
}
