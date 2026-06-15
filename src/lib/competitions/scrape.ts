// 공모전 수집 공통 — Jina Reader(외부 서버가 읽어 본문 반환)로 한국/봇차단 사이트 우회.
// analyze-url(수동 URL)과 webhooks/competitions(목록 자동수집)이 공유.

export interface PageContent { title: string; text: string; image: string | null }

// 개별 페이지 → 제목·본문·대표이미지
export async function fetchViaJina(url: string): Promise<PageContent> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "X-Return-Format": "markdown", Accept: "text/plain" },
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) throw new Error(`Jina ${res.status}`)
  const md = await res.text()
  const title = md.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || "(제목 없음)"
  const image = md.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)?.[1] ?? null
  return { title, text: md.slice(0, 4000), image }
}

// 목록 페이지 마크다운에서 개별 공모전 상세 URL 추출 (도메인별 패턴).
// 새 사이트는 여기에 패턴만 추가하면 됨.
export function extractListUrls(markdown: string, sourceUrl: string): string[] {
  let host = ""
  try { host = new URL(sourceUrl).hostname } catch { return [] }
  const urls = new Set<string>()

  if (host.includes("wevity")) {
    for (const m of markdown.matchAll(/ix=(\d+)/g)) {
      urls.add(`https://www.wevity.com/?c=find&s=1&gbn=view&ix=${m[1]}`)
    }
  } else if (host.includes("all-con")) {
    for (const m of markdown.matchAll(/\/view\/contest\/(\d+)/g)) {
      urls.add(`https://www.all-con.co.kr/view/contest/${m[1]}`)
    }
  } else {
    // 일반: 같은 호스트의 마크다운 링크 (view/detail/contest 포함)
    for (const m of markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) {
      const u = m[1]
      if (u.includes(host) && /view|detail|contest|notice|board/i.test(u)) urls.add(u)
    }
  }
  return [...urls]
}
