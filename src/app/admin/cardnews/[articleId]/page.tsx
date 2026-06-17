import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import CardnewsStudio from "./CardnewsStudio"
import type { Slide } from "@/lib/cardnews/types"

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ articleId: string }>
}

export default async function CardnewsPage({ params }: Props) {
  await requireAdmin()
  const { articleId } = await params
  const supabase = createAdminClient()

  const [{ data: article }, { data: insight }, { data: card }] = await Promise.all([
    supabase.from("articles").select("title, source_name").eq("id", articleId).single(),
    supabase.from("insights").select("hook, category").eq("article_id", articleId).single(),
    supabase.from("cardnews").select("*").eq("article_id", articleId).maybeSingle(),
  ])

  if (!article || !insight) notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/cardnews" className="text-xs text-muted-foreground hover:underline">
          ← 카드뉴스 관리
        </Link>
        <h1 className="text-xl font-semibold tracking-tight mt-2">카드뉴스 생성</h1>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
          {insight.hook ?? article.title} · {insight.category}
        </p>
      </div>

      <CardnewsStudio
        articleId={articleId}
        initialSlides={(card?.slides as Slide[]) ?? null}
        initialCategory={card?.category ?? insight.category ?? "마케팅"}
        initialCaption={(card as { caption?: string } | null)?.caption ?? null}
      />
    </div>
  )
}
