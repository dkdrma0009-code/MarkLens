import { createAdminClient } from "@/lib/supabase/admin"
import { formatDate } from "@/lib/utils"
import ArticleActions from "./ArticleActions"
import AnalyzeTrigger from "./AnalyzeTrigger"
import CollectTrigger from "./CollectTrigger"
import InsightPreview from "./InsightPreview"
import EditInsight from "./EditInsight"

export const dynamic = 'force-dynamic'

export default async function AdminArticlesPage() {
  const supabase = createAdminClient()

  const [{ data: articles }, { count: publishedCount }] = await Promise.all([
    supabase
      .from("articles")
      .select("*, insights(id, summary, category)")
      .in("status", ["pending", "analyzing", "ready", "rejected"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
  ])

  const waiting = articles?.filter(a => ["pending", "analyzing", "ready"].includes(a.status)) ?? []
  const rejected = articles?.filter(a => a.status === "rejected") ?? []

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">아티클 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            발행됨 <span className="font-medium text-foreground">{publishedCount ?? 0}개</span>
            {waiting.length > 0 && <> · 대기중 <span className="font-medium text-amber-600">{waiting.length}개</span></>}
            {rejected.length > 0 && <> · 거절됨 <span className="font-medium">{rejected.length}개</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CollectTrigger />
          <AnalyzeTrigger pendingCount={waiting.filter(a => a.status === "pending").length} />
        </div>
      </div>

      {waiting.length === 0 && rejected.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          검토할 아티클이 없습니다. RSS 수집 버튼을 눌러 새 아티클을 가져오세요.
        </div>
      ) : (
        <>
          {waiting.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
                대기중
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {waiting.length}
                </span>
              </h2>
              <ArticleTable articles={waiting} />
            </div>
          )}

          {rejected.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-4 text-muted-foreground flex items-center gap-2">
                거절됨
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {rejected.length}
                </span>
              </h2>
              <ArticleTable articles={rejected} />
            </div>
          )}
        </>
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
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">상태</th>
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
                <div className="flex items-center gap-2">
                  {article.insights?.[0] && (
                    <>
                      <InsightPreview
                        articleId={article.id}
                        articleTitle={article.title}
                        articleUrl={article.url}
                      />
                      <EditInsight articleId={article.id} />
                    </>
                  )}
                  <ArticleActions articleId={article.id} status={article.status} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending" || status === "analyzing" || status === "ready") {
    const labels: Record<string, string> = {
      pending: "수집됨",
      analyzing: "분석 중",
      ready: "준비 완료",
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
        {labels[status]}
      </span>
    )
  }
  if (status === "rejected") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
        거절됨
      </span>
    )
  }
  return null
}
