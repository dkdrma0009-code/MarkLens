import crypto from "node:crypto"

// GA4 Data API — 서비스 계정 JWT로 액세스 토큰 발급 후 REST 호출 (외부 의존성 없음)
// 필요한 환경변수: GA4_PROPERTY_ID, GA4_SA_CLIENT_EMAIL, GA4_SA_PRIVATE_KEY

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly"

let cached: { token: string; exp: number } | null = null

// private key를 어떤 형식으로 넣어도 유효 PEM으로 — literal \n / 실제 줄바꿈 / 줄바꿈 없는 한 줄 모두 처리
function normalizeKey(raw?: string): string {
  if (!raw) return ""
  let key = raw.trim().replace(/^["']|["']$/g, "")
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n")
  if (!key.includes("\n")) {
    const body = key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "")
    key = `-----BEGIN PRIVATE KEY-----\n${(body.match(/.{1,64}/g) || []).join("\n")}\n-----END PRIVATE KEY-----\n`
  }
  return key
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GA4_SA_CLIENT_EMAIL
  const key = normalizeKey(process.env.GA4_SA_PRIVATE_KEY)
  if (!email || !key) throw new Error("GA4 서비스 계정 미설정 (GA4_SA_CLIENT_EMAIL/PRIVATE_KEY)")

  const now = Math.floor(Date.now() / 1000)
  if (cached && cached.exp > now + 60) return cached.token

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const input = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`
  const signature = crypto.createSign("RSA-SHA256").update(input).sign(key).toString("base64url")
  const jwt = `${input}.${signature}`

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  })
  const j = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!res.ok || !j.access_token) throw new Error(`GA4 토큰 발급 실패: ${JSON.stringify(j)}`)
  cached = { token: j.access_token, exp: now + (j.expires_in ?? 3600) }
  return j.access_token
}

interface RawRow { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }
interface RawResp { rows?: RawRow[]; totals?: { metricValues?: { value: string }[] }[] }
export interface Ga4Row { dims: string[]; metrics: number[] }

async function runReport(body: object): Promise<{ rows: Ga4Row[]; totals: number[] }> {
  const pid = process.env.GA4_PROPERTY_ID
  if (!pid) throw new Error("GA4_PROPERTY_ID 미설정")
  const token = await getAccessToken()
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const j = (await res.json()) as RawResp & { error?: unknown }
  if (!res.ok) throw new Error(`GA4 리포트 실패: ${JSON.stringify(j.error ?? j)}`)
  const rows: Ga4Row[] = (j.rows ?? []).map(r => ({
    dims: (r.dimensionValues ?? []).map(d => d.value),
    metrics: (r.metricValues ?? []).map(m => Number(m.value)),
  }))
  const totals = (j.totals?.[0]?.metricValues ?? []).map(m => Number(m.value))
  return { rows, totals }
}

export interface Ga4Overview {
  summary: { activeUsers: number; sessions: number; pageViews: number; newUsers: number }
  daily: { date: string; users: number }[]
  sources: { source: string; sessions: number }[]
  pages: { path: string; views: number }[]
  devices: { device: string; sessions: number }[]
}

// 최근 28일 핵심 지표 묶음 — 미설정/오류 시 null (대시보드는 안내 문구로 폴백)
export async function getGa4Overview(): Promise<Ga4Overview | null> {
  if (!process.env.GA4_PROPERTY_ID || !process.env.GA4_SA_CLIENT_EMAIL) return null
  const dateRanges = [{ startDate: "28daysAgo", endDate: "today" }]
  try {
    const [summary, daily, sources, pages, devices] = await Promise.all([
      runReport({ dateRanges, metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "newUsers" }] }),
      runReport({ dateRanges, dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }], orderBys: [{ dimension: { dimensionName: "date" } }] }),
      runReport({ dateRanges, dimensions: [{ name: "sessionSourceMedium" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
      runReport({ dateRanges, dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 }),
      runReport({ dateRanges, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }] }),
    ])
    const s = summary.rows[0]?.metrics ?? summary.totals
    return {
      summary: { activeUsers: s[0] ?? 0, sessions: s[1] ?? 0, pageViews: s[2] ?? 0, newUsers: s[3] ?? 0 },
      daily: daily.rows.map(r => ({ date: r.dims[0], users: r.metrics[0] })),
      sources: sources.rows.map(r => ({ source: r.dims[0], sessions: r.metrics[0] })),
      pages: pages.rows.map(r => ({ path: r.dims[0], views: r.metrics[0] })),
      devices: devices.rows.map(r => ({ device: r.dims[0], sessions: r.metrics[0] })),
    }
  } catch (e) {
    console.warn("[GA4]", e instanceof Error ? e.message : e)
    return null
  }
}
