import { createAdminClient } from "@/lib/supabase/admin"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function CardnewsListPage() {
  const supabase = createAdminClient()

  const [{ data: insights }, { data: cards }] = await Promise.all([
    supabase
      .from("insights")
      .select("article_id, hook, category, created_at, article:articles!inner(title, status, image_url)")
      .eq("article.status", "published")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("cardnews").select("article_id, updated_at"),
  ])

  type Row = {
    article_id: string
    hook?: string | null
    category?: string | null
    created_at: string
    article?: { title?: string | null; status?: string | null; image_url?: string | null } | null
  }

  const rows = (insights ?? []) as Row[]
  const cardMap = new Map((cards ?? []).map(c => [c.article_id, c.updated_at]))
  const doneCount = rows.filter(r => cardMap.has(r.article_id)).length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">카드뉴스 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          발행된 인사이트 <span className="font-medium text-foreground">{rows.length}개</span>
          {" · "}카드뉴스 생성됨 <span className="font-medium text-foreground">{doneCount}개</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          발행된 인사이트가 없습니다.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">인사이트</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">카테고리</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">표지</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">발행일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const cardAt = cardMap.get(r.article_id)
                return (
                  <tr key={r.article_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 max-w-sm">
                      <p className="font-medium line-clamp-2 leading-snug">{r.hook ?? "—"}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.article?.title ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.category ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {cardAt ? (
                        // 생성된 카드는 실제 표지(1장) 렌더 썸네일 — updated_at으로 캐시버스트
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/admin/cardnews/render?articleId=${r.article_id}&slide=1&v=${encodeURIComponent(cardAt)}`}
                          alt="표지 미리보기"
                          loading="lazy"
                          className="w-10 h-[50px] object-cover rounded border border-border bg-black"
                        />
                      ) : r.article?.image_url ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">포토 표지</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">타이포 표지</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {cardAt ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                          생성됨 · {formatDate(cardAt)}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">미생성</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/cardnews/${r.article_id}`}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                          cardAt
                            ? "border border-border text-muted-foreground hover:bg-muted/50"
                            : "bg-foreground text-background hover:opacity-90"
                        }`}
                      >
                        {cardAt ? "편집" : "만들기"}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
