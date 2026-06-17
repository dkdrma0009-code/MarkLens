import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatDate } from "@/lib/utils"
import { ToggleSource, AddSourceForm } from "./RssSourceActions"

export const dynamic = "force-dynamic"

export default async function AdminSourcesPage() {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: sources } = await supabase
    .from("rss_sources")
    .select("*")
    .order("name")

  const active = sources?.filter(s => s.is_active).length ?? 0

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">RSS 소스 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            활성 소스 <span className="font-medium text-foreground">{active}개</span>
            {sources && ` / 전체 ${sources.length}개`}
          </p>
        </div>
        <AddSourceForm />
      </div>

      {!sources || sources.length === 0 ? (
        <div className="border border-border rounded-lg p-12 text-center text-sm text-muted-foreground bg-background">
          등록된 RSS 소스가 없습니다.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">소스명</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">슬러그</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">RSS URL</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">마지막 수집</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((source) => (
                <tr key={source.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <a
                      href={source.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline"
                    >
                      {source.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{source.slug}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                    <a
                      href={source.rss_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline truncate block"
                    >
                      {source.rss_url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {source.last_fetched_at ? formatDate(source.last_fetched_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSource id={source.id} isActive={source.is_active} />
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
