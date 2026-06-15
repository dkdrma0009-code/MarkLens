import { createAdminClient } from "@/lib/supabase/admin"
import CompetitionsClient from "./CompetitionsClient"
import type { Competition } from "@/types"

export const dynamic = "force-dynamic"

export default async function CompetitionsAdminPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("competitions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)

  const rows = (data ?? []) as Competition[]
  const pending = rows.filter(r => r.status === "pending").length

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">대외활동</h1>
        <p className="text-sm text-muted-foreground mt-1">
          전체 <span className="font-medium text-foreground">{rows.length}건</span>
          {" · "}검수 대기 <span className="font-medium text-foreground">{pending}건</span>
          {" · "}URL 입력 또는 본문 붙여넣기로 추가하면 LLM이 자동 분류합니다.
        </p>
      </div>
      <CompetitionsClient initialRows={rows} />
    </div>
  )
}
