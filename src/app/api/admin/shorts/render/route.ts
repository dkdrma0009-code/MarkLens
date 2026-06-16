import { NextResponse } from "next/server"
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

// 비동기 패턴: 렌더를 트리거하고 { renderId, bucketName, functionName } 즉시 반환
// 프론트엔드가 /status 폴링 → /download 에서 파일 수령
export async function POST(req: Request) {
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
  const rawSlug = insight?.slug ?? `cardnews-${articleId.slice(0, 6)}`
  const slug = /^[\w\-]+$/.test(rawSlug) ? rawSlug : `cardnews-${articleId.slice(0, 6)}`

  // ── 프로덕션: Lambda 렌더 트리거 후 즉시 반환 ──
  if (process.env.NODE_ENV !== "development") {
    const functionName = process.env.REMOTION_FUNCTION_NAME
    const serveUrl = process.env.REMOTION_SERVE_URL
    if (!functionName || !serveUrl) {
      return NextResponse.json({ error: "REMOTION_FUNCTION_NAME / REMOTION_SERVE_URL 미설정" }, { status: 500 })
    }

    // Lambda inputProps 256KB 한도 → base64 data URI 대신 URL 문자열로 전달
    // Remotion Lambda는 Chromium으로 렌더하므로 원격 URL 직접 로드 가능
    let coverImage: string | null = null
    if (usePhoto && article?.image_url) {
      coverImage = `https://images.weserv.nl/?url=${encodeURIComponent(article.image_url)}&output=jpg&w=1080&q=85`
    }

    const { renderMediaOnLambda } = await import("@remotion/lambda/client")
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: "ap-northeast-2",
      functionName,
      serveUrl,
      composition: "Shorts",
      inputProps: { slides, category, coverImage },
      codec: "h264",
      privacy: "private",
    })

    return NextResponse.json({ renderId, bucketName, functionName, slug })
  }

  // ── 로컬 개발: 번들러 직접 렌더 (동기) ──
  const coverImage = usePhoto ? await fetchImageDataUri(article?.image_url) : null
  const inputProps = { slides, category, coverImage }

  const path = await import("node:path")
  const os = await import("node:os")
  const { readFile, unlink } = await import("node:fs/promises")
  const { bundle } = await import("@remotion/bundler")
  const { renderMedia, selectComposition } = await import("@remotion/renderer")

  const localServeUrl = await bundle({
    entryPoint: path.default.join(process.cwd(), "src", "remotion", "index.ts"),
    publicDir: path.default.join(process.cwd(), "assets"),
  })
  const composition = await selectComposition({ serveUrl: localServeUrl, id: "Shorts", inputProps })
  const outputLocation = path.default.join(os.tmpdir(), `shorts-${slug}-${Date.now()}.mp4`)
  await renderMedia({ composition, serveUrl: localServeUrl, codec: "h264", outputLocation, inputProps })

  const buf = await readFile(outputLocation)
  await unlink(outputLocation).catch(() => {})
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="shorts-${slug}.mp4"`,
    },
  })
}
