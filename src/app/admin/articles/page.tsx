import { createAdminClient } from "@/lib/supabase/admin"
import { formatDate } from "@/lib/utils"
import ArticleActions from "./ArticleActions"
import AnalyzeTrigger from "./AnalyzeTrigger"

export const dynamic = 'force-dynamic'

export default async function AdminArticlesPage() {
  const supabase = createAdminClient()

  const [{ data: articles }, { count: publishedCount }] = await Promise.all([
    supabase
      .from("articles")
      .select("*, insights(id, summary, category)")
      .in("status", ["pending", "analyzing", "ready", "rejected"])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
  ])

  const byStatus = {
    pending: articles?.filter((a) => a.status === "pending") ?? [],
    ready: articles?.filter((a) => a.status === "ready") ?? [],
    analyzing: articles?.filter((a) => a.status === "analyzing") ?? [],
    rejected: articles?.filter((a) => a.status === "rejected") ?? [],
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">아티클 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            수집된 아티클을 검토하고 발행합니다
            {(publishedCount ?? 0) > 0 && (
              <span className="ml-2 text-xs">· 발행됨 {publishedCount}개</span>
            )}
          </p>
        </div>
        <AnalyzeTrigger pendingCount={byStatus.pending.length} />
      </div>

      {byStatus.ready.length === 0 && byStatus.pending.length === 0 && byStatus.analyzing.length === 0 && (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          검토할 아티클이 없습니다.
        </div>
      )}

      {byStatus.ready.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
            발행 준비 완료
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {byStatus.ready.length}
            </span>
          </h2>
          <ArticleTable articles={byStatus.ready} />
        </div>
      )}

      {byStatus.analyzing.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
            분석 중
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {byStatus.analyzing.length}
            </span>
          </h2>
          <ArticleTable articles={byStatus.analyzing} />
        </div>
      )}

      {byStatus.pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
            수집 완료 (분석 대기)
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {byStatus.pending.length}
            </span>
          </h2>
          <ArticleTable articles={byStatus.pending} />
        </div>
      )}

      {byStatus.rejected.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-4 text-muted-foreground flex items-center gap-2">
            거절됨
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {byStatus.rejected.length}
            </span>
          </h2>
          <ArticleTable articles={byStatus.rejected} />
        </div>
      )}
    </div>
  )
}

function ArticleTable({ articles }: { articles: any[] }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">제목</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">소스</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">카테고리</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">수집일</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {articles.map((article) => (
            <tr key={article.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <a href={article.url} target="_blank" rel="noopener noreferrer"
                  className="font-medium line-clamp-1 hover:underline">
                  {article.title}
                </a>
                {article.insights?.[0]?.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {article.insights[0].summary}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{article.source_name}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {article.insights?.[0]?.category ?? "—"}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(article.created_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={article.status} />
              </td>
              <td className="px-4 py-3">
                <ArticleActions articleId={article.id} status={article.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "수집됨", cls: "bg-gray-100 text-gray-600" },
    analyzing: { label: "분석 중", cls: "bg-blue-100 text-blue-600" },
    ready: { label: "준비 완료", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "거절됨", cls: "bg-red-100 text-red-600" },
  }
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
