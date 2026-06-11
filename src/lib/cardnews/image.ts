// 한 URL을 받아 PNG/JPEG일 때만 버퍼로 (매직바이트 판별 — CDN의 잘못된 content-type 무시)
async function tryFetchBuf(u: string): Promise<{ buf: Buffer; isPng: boolean } | null> {
  try {
    const res = await fetch(u, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    if (!isPng && !isJpeg) return null
    return { buf, isPng }
  } catch {
    return null
  }
}

async function tryFetch(u: string): Promise<string | null> {
  const r = await tryFetchBuf(u)
  if (!r) return null
  return `data:${r.isPng ? "image/png" : "image/jpeg"};base64,${r.buf.toString("base64")}`
}

// 픽셀 크기 추출 (Satori는 contain을 지원하지 않아 명시적 박스 계산에 필요)
function pngDims(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function jpegDims(buf: Buffer): { width: number; height: number } | null {
  let p = 2
  while (p + 9 < buf.length) {
    if (buf[p] !== 0xff) { p++; continue }
    const marker = buf[p + 1]
    // SOF0~SOF15 (단, DHT/JPG/DAC 제외)에 프레임 크기가 들어있다
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(p + 5), width: buf.readUInt16BE(p + 7) }
    }
    p += 2 + buf.readUInt16BE(p + 2)
  }
  return null
}

// data URI + 픽셀 크기 — 엔드카드처럼 contain 박스를 직접 계산해야 하는 곳용
export async function fetchImageWithDims(
  url: string | null | undefined
): Promise<{ dataUri: string; width: number; height: number } | null> {
  if (!url) return null
  let r = await tryFetchBuf(url)
  if (!r) {
    r = await tryFetchBuf(`https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg&w=1080&q=85`)
  }
  if (!r) return null
  const dims = r.isPng ? pngDims(r.buf) : jpegDims(r.buf)
  if (!dims || !dims.width || !dims.height) return null
  return {
    dataUri: `data:${r.isPng ? "image/png" : "image/jpeg"};base64,${r.buf.toString("base64")}`,
    ...dims,
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
