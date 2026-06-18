import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { publishReel } from "@/lib/instagram"
import { renderCardnewsBuffers } from "@/lib/cardnews/render-buffers"
import { CARDNEWS_BUCKET } from "@/lib/cardnews/publish"
import { isAdmin } from "@/lib/api-auth"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

export const maxDuration = 300

function parseS3Url(url: string): { bucket: string; key: string; region: string } | null {
  try {
    const u = new URL(url)
    const match = u.hostname.match(/^(.+)\.s3\.([^.]+)\.amazonaws\.com$/)
    if (!match) return null
    return { bucket: match[1], region: match[2], key: decodeURIComponent(u.pathname.slice(1)) }
  } catch {
    return null
  }
}

// 카드뉴스 표지(슬라이드 1)를 PNG로 렌더해 Supabase에 업로드 → weserv.nl JPEG URL 반환
async function uploadReelCover(articleId: string): Promise<string | null> {
  const rendered = await renderCardnewsBuffers(articleId)
  if (!rendered?.buffers[0]) return null

  const sb = createAdminClient()
  await sb.storage.createBucket(CARDNEWS_BUCKET, { public: true }).catch(() => {})

  const path = `${articleId}/reel-cover.png`
  const { error } = await sb.storage.from(CARDNEWS_BUCKET).upload(path, rendered.buffers[0], {
    contentType: "image/png",
    upsert: true,
  })
  if (error) {
    console.warn("[shorts/reels] 커버 이미지 업로드 실패:", error.message)
    return null
  }

  const publicUrl = sb.storage.from(CARDNEWS_BUCKET).getPublicUrl(path).data.publicUrl
  // Instagram은 JPEG를 요구 — weserv.nl로 변환
  return `https://images.weserv.nl/?url=${encodeURIComponent(publicUrl)}&output=jpg&w=1080`
}

// 렌더된 숏츠 mp4를 Instagram Reels로 발행 후 S3 파일 삭제 + DB 기록
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { outputFile, caption, articleId } = await req.json().catch(() => ({}))
  if (!outputFile) return NextResponse.json({ error: "outputFile 필요" }, { status: 400 })

  // 카드뉴스 표지를 릴스 썸네일로 — 실패해도 발행은 계속 진행
  let coverUrl: string | undefined
  if (articleId) {
    try {
      coverUrl = await uploadReelCover(articleId) ?? undefined
    } catch (e) {
      console.warn("[shorts/reels] 커버 생성 실패 (썸네일 없이 발행):", e instanceof Error ? e.message : e)
    }
  }

  let postId: string
  try {
    postId = await publishReel(outputFile, caption ?? "", coverUrl)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[shorts/reels] publishReel 실패:", msg)
    // 이미 업로드한 커버 PNG orphan 방지
    if (articleId && coverUrl) {
      const sb = createAdminClient()
      await sb.storage.from(CARDNEWS_BUCKET).remove([`${articleId}/reel-cover.png`]).catch(() => {})
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 발행 성공 시 DB에 기록
  if (articleId) {
    const sb = createAdminClient()
    const { error: dbErr } = await sb.from("cardnews")
      .update({ reels_posted_at: new Date().toISOString(), ig_post_id: postId })
      .eq("article_id", articleId)
    if (dbErr) console.error("[shorts/reels] DB 기록 실패:", dbErr.message)
  }

  // 발행 완료 후 S3 파일 삭제
  const parsed = parseS3Url(outputFile)
  if (parsed) {
    const s3 = new S3Client({
      region: parsed.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
    s3.send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }))
      .catch(e => console.error("[shorts/reels] S3 삭제 실패:", e))
  }

  return NextResponse.json({ postId })
}
