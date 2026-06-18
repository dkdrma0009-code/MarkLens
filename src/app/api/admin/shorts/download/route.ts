import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/api-auth"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

export const maxDuration = 60

function parseS3Url(url: string): { bucket: string; key: string; region: string } | null {
  try {
    const u = new URL(url)
    // https://{bucket}.s3.{region}.amazonaws.com/{key}
    const match = u.hostname.match(/^(.+)\.s3\.([^.]+)\.amazonaws\.com$/)
    if (!match) return null
    return { bucket: match[1], region: match[2], key: decodeURIComponent(u.pathname.slice(1)) }
  } catch {
    return null
  }
}

// Lambda가 완료되면 outputFile(S3 presigned URL)에서 파일을 받아 클라이언트로 전달.
// S3 presigned URL을 직접 클라이언트에 노출하지 않기 위해 프록시.
// 다운로드 완료 후 S3 파일 자동 삭제.
export async function GET(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const outputFile = searchParams.get("outputFile")
  const slug = searchParams.get("slug") ?? "shorts"

  if (!outputFile) return NextResponse.json({ error: "outputFile 필요" }, { status: 400 })

  const res = await fetch(outputFile)
  if (!res.ok) return NextResponse.json({ error: "S3 파일 수령 실패" }, { status: 502 })

  const buf = await res.arrayBuffer()

  // 다운로드 후 S3에서 삭제 (비동기 — 응답 지연 없음)
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
      .catch(e => console.error("[shorts/download] S3 삭제 실패:", e))
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="shorts-${slug}.mp4"`,
    },
  })
}
