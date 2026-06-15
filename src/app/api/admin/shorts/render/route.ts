import { NextResponse } from "next/server"
import path from "node:path"
import os from "node:os"
import { readFile, unlink } from "node:fs/promises"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fetchImageDataUri } from "@/lib/cardnews/image"
import type { Slide } from "@/lib/cardnews/types"

export const maxDuration = 300

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 카드뉴스 → 숏츠(mp4) 렌더. Remotion 풀렌더는 Vercel 서버리스에서 불가(시간·메모리) → 로컬 개발 전용.
// 향후 Lambda 전환 시 @remotion/lambda renderMediaOnLambda()로 분기 교체.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "숏츠 렌더는 로컬 개발 환경에서만 가능합니다 (Vercel 서버리스 미지원)" }, { status: 405 })
  }
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { articleId } = await req.json().catch(() => ({}))
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  const supabase = createAdminClient()
  const [{ data: card }, { data: insight }, { data: article }] = await Promise.all([
    supabase.from("cardnews").select("slides, category").eq("article_id", articleId).single(),
    supabase.from("insights").select("slug").eq("article_id", articleId).single(),
    supabase.from("articles").select("image_url").eq("id", articleId).single(),
  ])
  if (!card?.slides) return NextResponse.json({ error: "카드뉴스가 없습니다 (먼저 생성하세요)" }, { status: 404 })

  const slides = card.slides as Slide[]
  const category = card.category ?? "마케팅"
  const usePhoto = (slides[0] as { usePhoto?: boolean })?.usePhoto !== false
  const coverImage = usePhoto ? await fetchImageDataUri(article?.image_url) : null
  const rawSlug = insight?.slug ?? `cardnews-${articleId.slice(0, 6)}`
  const slug = /^[\w\-]+$/.test(rawSlug) ? rawSlug : `cardnews-${articleId.slice(0, 6)}`

  // 동적 import — 빌드/배포 번들에서 분리 (next.config serverExternalPackages와 함께)
  const { bundle } = await import("@remotion/bundler")
  const { renderMedia, selectComposition } = await import("@remotion/renderer")

  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src", "remotion", "index.ts"),
    publicDir: path.join(process.cwd(), "assets"), // Pretendard OTF (staticFile)
  })
  const inputProps = { slides, category, coverImage }
  const composition = await selectComposition({ serveUrl, id: "Shorts", inputProps })
  const outputLocation = path.join(os.tmpdir(), `shorts-${slug}-${Date.now()}.mp4`)
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation, inputProps })

  const buf = await readFile(outputLocation)
  await unlink(outputLocation).catch(() => {})
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="shorts-${slug}.mp4"`,
    },
  })
}
