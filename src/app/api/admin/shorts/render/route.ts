import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchImageDataUri } from "@/lib/cardnews/image"
import { isAdmin } from "@/lib/api-auth"
import { generateReelScript } from "@/lib/shorts/reel-script"
import type { Slide } from "@/lib/cardnews/types"

export const maxDuration = 300

// 키네틱 릴스가 쓰는 실사 스톡 b-roll 목록(assets/video/stock/). 컴포지션의 STOCK_CLIPS 와
// 같은 규칙 — 여기서 다시 만드는 이유는 라우트에 remotion 모듈을 끌어오지 않기 위해서다.
const STOCK_CLIPS = Array.from({ length: 30 }, (_, i) => `video/stock/s${String(i + 1).padStart(2, "0")}.mp4`)

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
  // ReelKineticVideo는 슬라이드가 아니라 인사이트에서 뽑은 대본 비트 + 실사 b-roll 컷.
  const COMPOSITIONS = ["Shorts", "Reel", "ReelKineticVideo"] as const
  type CompositionId = (typeof COMPOSITIONS)[number]
  const compositionId: CompositionId = composition ?? "Shorts"
  if (!COMPOSITIONS.includes(compositionId)) {
    return NextResponse.json({ error: `composition은 ${COMPOSITIONS.join(" | ")} 중 하나여야 합니다` }, { status: 400 })
  }
  const filePrefix = compositionId.toLowerCase()
  const isKinetic = compositionId === "ReelKineticVideo"

  const supabase = createAdminClient()
  const [{ data: card }, { data: insight }, { data: article }] = await Promise.all([
    supabase.from("cardnews").select("slides, category, caption").eq("article_id", articleId).single(),
    supabase.from("insights").select("slug, hook, summary, key_takeaways, framework_analysis").eq("article_id", articleId).single(),
    supabase.from("articles").select("image_url").eq("id", articleId).single(),
  ])

  const category = card?.category ?? "마케팅"
  const rawSlug = insight?.slug ?? `cardnews-${articleId.slice(0, 6)}`
  const slug = /^[\w\-]+$/.test(rawSlug) ? rawSlug : `cardnews-${articleId.slice(0, 6)}`

  // ── 컴포지션별 inputProps 구성 ──────────────────────────────────────────
  // 슬라이드 컷(Shorts/Reel)은 coverImage 가 prod/local 에서 형태가 달라 각 렌더 경로에서
  // 합친다. 키네틱은 여기서 완결(beats + clips) — coverImage 개념이 없다.
  let baseProps: Record<string, unknown>
  let caption: string | null = card?.caption ?? null
  let usePhoto = false
  let framesPerLambda = 150

  if (isKinetic) {
    const src = {
      category,
      hook: insight?.hook ?? null,
      summary: insight?.summary ?? null,
      keyTakeaways: (insight?.key_takeaways as string[] | null) ?? null,
      frameworkAnalysis: (insight?.framework_analysis as string | null) ?? null,
    }
    if (!src.hook && !src.summary && !src.keyTakeaways?.length) {
      return NextResponse.json({ error: "인사이트가 없습니다 (먼저 생성하세요)" }, { status: 404 })
    }
    let script
    try {
      script = await generateReelScript(src)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `대본 생성 실패: ${msg}` }, { status: 500 })
    }
    baseProps = { beats: script.beats, category, clips: STOCK_CLIPS }
    caption = script.caption || caption
    // 45~65초라 프레임이 1350~1950개. 신규 AWS 계정 동시성 한도를 넘기지 않게 청크를
    // 크게 잡아 Lambda 수를 줄인다(150 → 45초 9청크). b-roll 디코딩이 붙어도 타이포라
    // 그레인 필터가 없어 청크당 120초 안에 든다.
    framesPerLambda = 150
  } else {
    if (!card?.slides) return NextResponse.json({ error: "카드뉴스가 없습니다 (먼저 생성하세요)" }, { status: 404 })
    const slides = card.slides as Slide[]
    usePhoto = (slides[0] as { usePhoto?: boolean })?.usePhoto !== false
    baseProps = { slides, category, settings, photos }
    framesPerLambda = compositionId === "Reel" ? 80 : 150
  }

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
    const inputProps = isKinetic ? baseProps : { ...baseProps, coverImage }

    const { renderMediaOnLambda } = await import("@remotion/lambda/client")
    let renderId: string, bucketName: string
    try {
      const result = await renderMediaOnLambda({
        region: "ap-northeast-2",
        functionName,
        serveUrl,
        composition: compositionId,
        // settings는 미리보기(Player)에서 조절한 연출값. 여기로 그대로 넘기지 않으면
        // 미리보기와 최종 렌더가 달라진다. Shorts·키네틱은 이 prop을 무시한다.
        inputProps,
        codec: "h264",
        // private → outputFile이 presigned URL(서명 포함). 다운로드·릴스(IG fetch) 모두 이걸로 동작.
        // public(공개 ACL)을 쓰면 역할에 s3:PutObjectAcl 권한이 필요해 실패 → private은 그 호출 자체가 없음.
        privacy: "private",
        // 동시 Lambda 수는 적게 유지하되(신규 계정 한도), 청크 하나가 120초 제한에
        // 걸리지 않을 만큼은 쪼갠다. 키네틱은 b-roll 디코딩이 붙어 더 잘게 쪼갠다.
        framesPerLambda,
        maxRetries: 1,
      })
      renderId = result.renderId
      bucketName = result.bucketName
    } catch (e: unknown) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      console.error("[shorts/render] Lambda 트리거 실패:", msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ renderId, bucketName, functionName, slug, caption })
  }

  // ── 로컬 개발: 번들러 직접 렌더 (동기) ──
  const coverImage = !isKinetic && usePhoto ? await fetchImageDataUri(article?.image_url) : null
  const inputProps = isKinetic ? baseProps : { ...baseProps, coverImage }

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
