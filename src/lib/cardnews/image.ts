// 대표 이미지를 data URI로 변환 — Satori가 원격 fetch에 실패해 렌더가 깨지는 것 방지
// ImageResponse(Satori)는 PNG/JPEG만 안정적으로 디코딩한다. WebP/AVIF/SVG/GIF를 넘기면
// 렌더가 통째로 500으로 터지므로, 매직바이트로 PNG·JPEG만 임베드하고 나머지는 null → 타이포 표지 폴백.
// (content-type 헤더는 CDN이 잘못 줄 수 있어 실제 바이트로 판별)
export async function fetchImageDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    if (!isPng && !isJpeg) return null
    return `data:${isPng ? "image/png" : "image/jpeg"};base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}
