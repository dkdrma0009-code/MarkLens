import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/api-auth"

export const maxDuration = 30

export async function GET(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const renderId = searchParams.get("renderId")
  const bucketName = searchParams.get("bucketName")
  const functionName = searchParams.get("functionName")

  if (!renderId || !bucketName || !functionName) {
    return NextResponse.json({ error: "renderId, bucketName, functionName 필요" }, { status: 400 })
  }

  const { getRenderProgress } = await import("@remotion/lambda/client")
  const progress = await getRenderProgress({
    renderId,
    bucketName,
    functionName,
    region: "ap-northeast-2",
  })

  if (progress.fatalErrorEncountered) {
    const msg = (progress.errors as {message?: string}[])?.[0]?.message ?? "unknown"
    return NextResponse.json({ status: "error", error: `Lambda 렌더 실패: ${msg}` })
  }

  if (progress.done && progress.outputFile) {
    return NextResponse.json({ status: "done", outputFile: progress.outputFile, percent: 100 })
  }

  const percent = Math.round((progress.overallProgress ?? 0) * 100)
  return NextResponse.json({ status: "rendering", percent })
}
