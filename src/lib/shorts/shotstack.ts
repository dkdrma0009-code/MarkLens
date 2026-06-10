// Shotstack 연동 — 샌드박스(stage) 기본. 프로덕션 전환 시 SHOTSTACK_ENV=v1
const BASE = `https://api.shotstack.io/edit/${process.env.SHOTSTACK_ENV || "stage"}`

type Clip = { asset: Record<string, unknown>; start: number; length: number; effect?: string; fit?: string }
type Track = { clips: Clip[] }

export interface ShotstackStatus {
  status: string
  url?: string
  poster?: string
  error?: string
}

// 이미지(줌) + 오버레이(정지) + 선택적 배경음악으로 9:16 타임라인 구성
export function buildTimeline(opts: { imageUrl: string; overlayUrl: string; durationSec?: number }) {
  const dur = opts.durationSec ?? 6
  const tracks: Track[] = [
    // 위 트랙 = 텍스트 오버레이(정지, 줌 없음)
    { clips: [{ asset: { type: "image", src: opts.overlayUrl }, start: 0, length: dur, fit: "cover" }] },
  ]
  // 아래 트랙 = 배경 이미지(켄번스 줌)
  if (opts.imageUrl) {
    tracks.push({ clips: [{ asset: { type: "image", src: opts.imageUrl }, start: 0, length: dur, effect: "zoomIn", fit: "cover" }] })
  }

  const music = process.env.SHOTSTACK_MUSIC_URL
  return {
    timeline: {
      background: "#0A0A0A",
      ...(music ? { soundtrack: { src: music, effect: "fadeOut" } } : {}),
      tracks,
    },
    output: { format: "mp4", size: { width: 1080, height: 1920 }, poster: { capture: Math.min(3, dur - 1) } },
  }
}

export async function submitShotstack(timeline: object): Promise<string> {
  const key = process.env.SHOTSTACK_API_KEY
  if (!key) throw new Error("SHOTSTACK_API_KEY 미설정")
  const res = await fetch(`${BASE}/render`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(timeline),
  })
  const j = await res.json().catch(() => ({}))
  const id = j?.response?.id
  if (!res.ok || !id) throw new Error(`Shotstack 제출 실패: ${JSON.stringify(j)}`)
  return id as string
}

export async function getShotstack(id: string): Promise<ShotstackStatus> {
  const key = process.env.SHOTSTACK_API_KEY
  if (!key) throw new Error("SHOTSTACK_API_KEY 미설정")
  const res = await fetch(`${BASE}/render/${id}`, { headers: { "x-api-key": key } })
  const j = await res.json().catch(() => ({}))
  const r = j?.response ?? {}
  return { status: r.status ?? "unknown", url: r.url, poster: r.poster, error: r.error }
}
