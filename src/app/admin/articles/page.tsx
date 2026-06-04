import { createAdminClient } from "@/lib/supabase/admin"
import { formatDate } from "@/lib/utils"
import type { Article } from "@/types"
import ArticleActions from "./ArticleActions"
import AnalyzeTrigger from "./AnalyzeTrigger"
import CollectTrigger from "./CollectTrigger"
import InsightPreview from "./InsightPreview"
import EditInsight from "./EditInsight"
import PublishAllTrigger from "./PublishAllTrigger"
import Link from "next/link"

export const dynamic = 'force-dynamic'

const CASE_SOURCES = ["muse-by-clio", "campaign-brief", "adweek", "creative-review"]

interface Props {
  searchParams: Promise<{ type?: string }>
}

export default async function AdminArticlesPage({ searchParams }: Props) {
  const { type } = await searchParams
  const isCase = type === "case"

  const supabase = createAdminClient()

  let query = supabase
    .from("articles")
    .select("*, insights(id, summary, category)")
    .in("status", ["pending", "analyzing", "ready", "rejected"])
    .order("created_at", { ascending: false })
    .limit(100)

  if (isCase) {
    query = query.in("source", CASE_SOURCES)
  } else {
    query = query.not("source", "in", `(${CASE_SOURCES.map(s => `"${s}"`).join(",")})`)
  }

  const [{ data: articles }, { count: publishedCount }] = await Promise.all([
    query,
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .then(async (r) => {
        // 타입별 발행 수
        let q = supabase.from("articles").select("*", { count: "exact", head: true }).eq("status", "published")
        if (isCase) q = q.in("source", CASE_SOURCES)
        else q = q.not("source", "in", `(${CASE_SOURCES.map(s => `"${s}"`).join(",")})`)
        return q
      }),
  ])

  const waiting = articles?.filter(a => ["pending", "analyzing", "ready"].includes(a.status)) ?? []
  const rejected = articles?.filter(a => a.status === "rejected") ?? []

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">아티클 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            대기중 <span className="font-medium text-amber-600">{waiting.length}개</span>
            {rejected.length > 0 && <> · 거절됨 <span className="font-medium">{rejected.length}개</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CollectTrigger />
          <AnalyzeTrigger pendingCount={waiting.filter(a => a.status === "pending").length} />
          <PublishAllTrigger readyCount={waiting.filter(a => a.status === "ready").length} />
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <Link
          href="/admin/articles"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            !isCase ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          인사이트
        </Link>
        <Link
          href="/admin/articles?type=case"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            isCase ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          캠페인
        </Link>
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

type ArticleWithInsights = Article & {
  insights?: { id: string; summary?: string; category?: string }[]
  raw_content?: string | null
  image_url?: string | null
}

function ArticleTable({ articles }: { articles: ArticleWithInsights[] }) {
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
                  <InsightPreview
                    articleId={article.id}
                    articleTitle={article.title}
                    articleUrl={article.url}
                    sourceName={article.source_name}
                    rawContent={article.raw_content}
                    imageUrl={article.image_url}
                    hasInsight={!!article.insights?.[0]}
                  />
                  {article.insights?.[0] && (
                    <EditInsight articleId={article.id} />
                  )}
                  <ArticleActions articleId={article.id} status={article.status} hasInsight={!!article.insights?.[0]?.summary} />
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
  if (["pending", "analyzing", "ready"].includes(status)) {
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
