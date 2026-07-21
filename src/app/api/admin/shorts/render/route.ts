import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchImageDataUri } from "@/lib/cardnews/image"
import { isAdmin } from "@/lib/api-auth"
import type { Slide } from "@/lib/cardnews/types"

export const maxDuration = 300

// 비동기 패턴: 렌더를 트리거하고 { renderId, bucketName, functionName } 즉시 반환
// 프론트엔드가 /status 폴링 → /download 에서 파일 수령
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // photos는 미리보기가 해석해 둔 장면별 배경 사진. 여기서 다시 조회하지 않는다 —
  // Unsplash가 다른 사진을 돌려주면 미리보기와 결과가 달라진다.
  const { articleId, composition, settings, photos } = await req.json().catch(() => ({}))
  if (!articleId) return NextResponse.json({ error: "articleId required" }, { status: 400 })

  // 렌더할 컴포지션. 미지정 시 Shorts — 기존 호출부는 그대로 동작한다.
  // Reel은 정보 나열 장면(fact·keywords)을 빼고 켄번즈 모션을 넣은 릴스 전용 컷.
  const COMPOSITIONS = ["Shorts", "Reel"] as const
  type CompositionId = (typeof COMPOSITIONS)[number]
  const compositionId: CompositionId = composition ?? "Shorts"
  if (!COMPOSITIONS.includes(compositionId)) {
    return NextResponse.json({ error: `composition은 ${COMPOSITIONS.join(" | ")} 중 하나여야 합니다` }, { status: 400 })
  }
  const filePrefix = compositionId.toLowerCase()

  const supabase = createAdminClient()
  const [{ data: card }, { data: insight }, { data: article }] = await Promise.all([
    supabase.from("cardnews").select("slides, category, caption").eq("article_id", articleId).single(),
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
    let renderId: string, bucketName: string
    try {
      const result = await renderMediaOnLambda({
        region: "ap-northeast-2",
        functionName,
        serveUrl,
        composition: compositionId,
        // settings는 미리보기(Player)에서 조절한 연출값. 여기로 그대로 넘기지 않으면
        // 미리보기와 최종 렌더가 달라진다. Shorts는 이 prop을 무시한다.
        inputProps: { slides, category, coverImage, settings, photos },
        codec: "h264",
        // private → outputFile이 presigned URL(서명 포함). 다운로드·릴스(IG fetch) 모두 이걸로 동작.
        // public(공개 ACL)을 쓰면 역할에 s3:PutObjectAcl 권한이 필요해 실패 → private은 그 호출 자체가 없음.
        privacy: "private",
        // 동시 Lambda 수는 적게 유지하되(신규 계정 한도), 청크 하나가 120초 제한에
        // 걸리지 않을 만큼은 쪼갠다. cinematic 은 그레인·그레이딩 필터가 붙어
        // 프레임당 비용이 Shorts보다 크다.
        framesPerLambda: compositionId === "Reel" ? 80 : 150,
        maxRetries: 1,
      })
      renderId = result.renderId
      bucketName = result.bucketName
    } catch (e: unknown) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      console.error("[shorts/render] Lambda 트리거 실패:", msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ renderId, bucketName, functionName, slug, caption: card.caption ?? null })
  }

  // ── 로컬 개발: 번들러 직접 렌더 (동기) ──
  const coverImage = usePhoto ? await fetchImageDataUri(article?.image_url) : null
  const inputProps = { slides, category, coverImage, settings, photos }

  const path = await import("node:path")
  const os = await import("node:os")
  const { readFile, unlink } = await import("node:fs/promises")
  const { bundle } = await import("@remotion/bundler")
  const { renderMedia, selectComposition } = await import("@remotion/renderer")

  const localServeUrl = await bundle({
    entryPoint: path.default.join(process.cwd(), "src", "remotion", "index.ts"),
    publicDir: path.default.join(process.cwd(), "assets"),
  })
  const selected = await selectComposition({ serveUrl: localServeUrl, id: compositionId, inputProps })
  const outputLocation = path.default.join(os.tmpdir(), `${filePrefix}-${slug}-${Date.now()}.mp4`)
  await renderMedia({ composition: selected, serveUrl: localServeUrl, codec: "h264", outputLocation, inputProps })

  const buf = await readFile(outputLocation)
  await unlink(outputLocation).catch(() => {})
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filePrefix}-${slug}.mp4"`,
    },
  })
}
