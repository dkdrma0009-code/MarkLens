// 한 URL을 받아 PNG/JPEG일 때만 data URI로 변환 (매직바이트 판별 — CDN의 잘못된 content-type 무시)
async function tryFetch(u: string): Promise<string | null> {
  try {
    const res = await fetch(u, { signal: AbortSignal.timeout(6000) })
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

// 대표 이미지를 data URI로 변환해 표지 배경으로 사용.
// ImageResponse(Satori)는 PNG/JPEG만 디코딩 가능한데 매체 CDN은 webp/avif로 주는 경우가 많다.
//  1) 원본 직접 시도 — 이미 PNG/JPEG면 그대로 사용 (외부 의존 없음, 빠름)
//  2) webp/avif 등이면 이미지 프록시(weserv)로 jpeg 변환해 재시도
//  3) 둘 다 실패하면 null → 타이포 표지로 폴백
export async function fetchImageDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  const direct = await tryFetch(url)
  if (direct) return direct
  const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&w=1080&q=85`
  return tryFetch(proxied)
}
