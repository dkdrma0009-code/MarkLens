import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { publishReel } from "@/lib/instagram"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

export const maxDuration = 120

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

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

// 렌더된 숏츠 mp4를 Instagram Reels로 발행 후 S3 파일 삭제
export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { outputFile, caption } = await req.json().catch(() => ({}))
  if (!outputFile) return NextResponse.json({ error: "outputFile 필요" }, { status: 400 })

  const postId = await publishReel(outputFile, caption ?? "")

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
