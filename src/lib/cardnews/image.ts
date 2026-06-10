// 대표 이미지를 data URI로 변환 — Satori가 원격 fetch에 실패해 렌더가 깨지는 것 방지
// 실패(404, 타임아웃, 비이미지, 8MB 초과) 시 null → 타이포 표지로 폴백
export async function fetchImageDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const type = res.headers.get("content-type") ?? "image/jpeg"
    if (!type.startsWith("image/")) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    return `data:${type};base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}
