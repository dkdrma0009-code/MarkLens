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

// 카드뉴스 → 숏츠(mp4) 렌더.
// 프로덕션: AWS Lambda (ap-northeast-2) — renderMediaOnLambda()
// 로컬 개발: Remotion 번들러 직접 렌더
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
  const coverImage = usePhoto ? await fetchImageDataUri(article?.image_url) : null
  const rawSlug = insight?.slug ?? `cardnews-${articleId.slice(0, 6)}`
  const slug = /^[\w\-]+$/.test(rawSlug) ? rawSlug : `cardnews-${articleId.slice(0, 6)}`
  const inputProps = { slides, category, coverImage }

  // ── 프로덕션: Lambda 렌더 ──
  if (process.env.NODE_ENV !== "development") {
    const functionName = process.env.REMOTION_FUNCTION_NAME
    const serveUrl = process.env.REMOTION_SERVE_URL
    if (!functionName || !serveUrl) {
      return NextResponse.json({ error: "REMOTION_FUNCTION_NAME / REMOTION_SERVE_URL 미설정" }, { status: 500 })
    }

    const { renderMediaOnLambda, getRenderProgress } = await import("@remotion/lambda/client")

    const { renderId, bucketName } = await renderMediaOnLambda({
      region: "ap-northeast-2",
      functionName,
      serveUrl,
      composition: "Shorts",
      inputProps,
      codec: "h264",
      privacy: "private",
    })

    // 완료 대기 (최대 55초 — Vercel 제한 여유)
    const deadline = Date.now() + 55_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000))
      const progress = await getRenderProgress({ renderId, bucketName, functionName, region: "ap-northeast-2" })
      if (progress.fatalErrorEncountered) {
        return NextResponse.json({ error: `Lambda 렌더 실패: ${(progress.errors as {message?: string}[])?.[0]?.message ?? "unknown"}` }, { status: 500 })
      }
      if (progress.done && progress.outputFile) {
        const buf = await fetch(progress.outputFile).then(r => r.arrayBuffer())
        return new Response(new Uint8Array(buf), {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="shorts-${slug}.mp4"`,
          },
        })
      }
    }
    return NextResponse.json({ error: "Lambda 렌더 타임아웃 — 잠시 후 재시도하세요" }, { status: 504 })
  }

  // ── 로컬 개발: 번들러 직접 렌더 ──
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
