import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import InsightActions from "./InsightActions"
import ShareCopy from "./ShareCopy"

export const dynamic = "force-dynamic"

export default async function AdminInsightsPage() {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: insights } = await supabase
    .from("insights")
    .select("id, slug, hook, summary, tags, category, view_count, created_at, article_id, article:articles(title, source_name, status)")
    .order("created_at", { ascending: false })
    .limit(200)

  type InsightRow = {
    id: string
    slug: string
    hook?: string | null
    summary?: string | null
    tags?: string[] | null
    category?: string | null
    view_count?: number | null
    created_at: string
    article_id: string
    article?: { title?: string | null; source_name?: string | null; status?: string | null } | null
  }

  const rows = (insights ?? []) as InsightRow[]
  const published = rows.filter(r => r.article?.status === "published")

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">인사이트 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          전체 <span className="font-medium text-foreground">{rows.length}개</span>
          {published.length > 0 && (
            <> · 발행됨 <span className="font-medium text-foreground">{published.length}개</span></>
          )}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          인사이트가 없습니다.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">인사이트</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">카테고리</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">소스</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">조회수</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">생성일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((insight) => (
                <tr key={insight.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <Link
                      href={`/insights/${insight.slug}`}
                      target="_blank"
                      className="font-medium line-clamp-2 hover:underline leading-snug"
                    >
                      {insight.hook ?? "—"}
                    </Link>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {insight.article?.title ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {insight.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {insight.article?.source_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={insight.article?.status ?? ""} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                    {(insight.view_count ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(insight.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {insight.article?.status === "published" && (
                        <ShareCopy hook={insight.hook} summary={insight.summary} slug={insight.slug} category={insight.category} tags={insight.tags} />
                      )}
                      <InsightActions insightId={insight.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap">
        발행됨
      </span>
    )
  }
  if (status === "ready") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
        준비 완료
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
      {status || "—"}
    </span>
  )
}
