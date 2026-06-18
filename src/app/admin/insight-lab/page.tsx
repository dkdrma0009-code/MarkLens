import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/api-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import ChallengeForm from "./_components/ChallengeForm"

export default async function AdminInsightLabPage() {
  if (!await isAdmin()) redirect("/")

  const sb = createAdminClient()
  const { data: challenges } = await sb
    .from("insight_challenges")
    .select("*")
    .order("published_date", { ascending: false })
    .limit(30)

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 mb-4 inline-block">← 어드민</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">챌린지 관리</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 신규 챌린지 등록 */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">새 챌린지 등록</h2>
          <ChallengeForm />
        </div>

        {/* 챌린지 목록 */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">챌린지 목록 ({challenges?.length ?? 0}개)</h2>
          <div className="flex flex-col gap-2">
            {(challenges ?? []).map(ch => (
              <div key={ch.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{ch.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ch.published_date} · {ch.difficulty} · {ch.category}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ch.active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "text-gray-400 bg-gray-100 dark:bg-gray-800"}`}>
                  {ch.active ? "활성" : "비활성"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
