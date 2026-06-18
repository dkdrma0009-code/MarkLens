// Remotion 미사용 — server component / API route / ImageResponse(Satori)에서 안전하게 임포트 가능

/* ── 숏츠(9:16) 디자인 토큰 ── */
export const VTOKENS = {
  BG: "#0A0A0A",
  TEXT: "#FFFFFF",
  BODY: "#EDEDED",
  SUB: "#A1A1A1",
  ACCENT: "#6366F1",
  PADDING: 110,
  WIDTH: 1080,
  HEIGHT: 1920,
  FONT: "Pretendard",
}

const T = VTOKENS

/* ── 캠페인 논평/큐레이션 프레임 (BARK 스타일: 풀블리드 이미지 + 오버레이 텍스트) ── */
export function renderCampaignFrame(opts: {
  image: string | null
  category: string
  headline: string
  caption: string
  source: string
  transparent?: boolean
}): React.ReactElement {
  const { image, category, headline, caption, source, transparent } = opts
  return (
    <div style={{ width: T.WIDTH, height: T.HEIGHT, display: "flex", position: "relative", background: transparent ? "transparent" : T.BG, fontFamily: T.FONT }}>
      {image && !transparent ? (
        <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: T.HEIGHT, display: "flex", backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      ) : null}
      <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: 760, display: "flex", background: "linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0) 100%)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: T.WIDTH, height: 680, display: "flex", background: "linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", padding: T.PADDING }}>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, color: "#fff", letterSpacing: "0.18em" }}>MARKLENS</div>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: T.ACCENT, letterSpacing: "0.06em", marginTop: 26 }}>{category}</div>
        <div style={{ display: "flex", width: 880, marginTop: 36, fontSize: 92, fontWeight: 700, color: "#fff", lineHeight: 1.22, letterSpacing: "-0.02em", textAlign: "center", wordBreak: "keep-all" }}>
          {headline}
        </div>
        <div style={{ display: "flex", flexGrow: 1 }} />
        <div style={{ display: "flex", width: 900, fontSize: 52, fontWeight: 600, color: "#fff", lineHeight: 1.45, textAlign: "center", wordBreak: "keep-all", marginBottom: 30 }}>
          {caption}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.78)" }}>출처 · {source}</div>
      </div>
    </div>
  )
}

/* ── AI 광고 매거진 패키징 ── */
export function renderAdOverlay(opts: {
  masthead?: string
  tagline?: string
  headline1: string
  headline2?: string
  highlight?: string
  handle?: string
}): React.ReactElement {
  const { masthead = "MarkLens", tagline, headline1, headline2, highlight, handle = "@marklens.site" } = opts

  function hl(line: string, key: number) {
    if (!highlight || !line.includes(highlight)) {
      return <div key={key} style={{ display: "flex", color: "#fff" }}>{line}</div>
    }
    const i = line.indexOf(highlight)
    return (
      <div key={key} style={{ display: "flex" }}>
        {line.slice(0, i) ? <span style={{ color: "#fff" }}>{line.slice(0, i)}</span> : null}
        <span style={{ color: T.ACCENT }}>{highlight}</span>
        {line.slice(i + highlight.length) ? <span style={{ color: "#fff" }}>{line.slice(i + highlight.length)}</span> : null}
      </div>
    )
  }

  return (
    <div style={{ width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column", background: "transparent", fontFamily: T.FONT }}>
      <div style={{ width: T.WIDTH, height: 470, display: "flex", flexDirection: "column", alignItems: "center", background: "#0A0A0A", paddingTop: 96 }}>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#F2F0EB", fontFamily: "Playfair", letterSpacing: "0.04em" }}>
          {masthead}
        </div>
        {tagline ? (
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, fontStyle: "italic", color: T.SUB, fontFamily: "Playfair", marginTop: 14, letterSpacing: "0.03em" }}>
            {tagline}
          </div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40, fontSize: 58, fontWeight: 700, lineHeight: 1.32, letterSpacing: "-0.01em", textAlign: "center", wordBreak: "keep-all", fontFamily: "Pretendard" }}>
          {[headline1, headline2].filter(Boolean).map((line, i) => hl(line as string, i))}
        </div>
      </div>
      <div style={{ display: "flex", flexGrow: 1 }} />
      <div style={{ width: T.WIDTH, height: 190, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0A0A0A", paddingLeft: T.PADDING, paddingRight: T.PADDING }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: T.SUB, letterSpacing: "0.14em" }}>MARKLENS</div>
        <div style={{ display: "flex", fontSize: 32, color: T.SUB }}>{handle}</div>
      </div>
    </div>
  )
}

/* ── 엔드카드 ── */
export function renderAdEndcard(opts: {
  image: string | null
  imageDims?: { width: number; height: number } | null
  title?: string
  sub?: string
  handle?: string
}): React.ReactElement {
  const { image, imageDims, title = "이 광고, AI로 만들었습니다", sub, handle = "@marklens.site" } = opts
  const box = { width: 560, height: 760 }
  if (imageDims && imageDims.width > 0 && imageDims.height > 0) {
    const scale = Math.min(560 / imageDims.width, 760 / imageDims.height)
    box.width = Math.round(imageDims.width * scale)
    box.height = Math.round(imageDims.height * scale)
  }
  return (
    <div style={{ width: T.WIDTH, height: T.HEIGHT, display: "flex", flexDirection: "column", alignItems: "center", background: T.BG, fontFamily: T.FONT, paddingTop: 200, paddingBottom: 110 }}>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: "#F2F0EB", fontFamily: "Playfair", letterSpacing: "0.04em" }}>MarkLens</div>
      {image ? (
        <div style={{ display: "flex", width: 560, height: 760, marginTop: 90, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", width: box.width, height: box.height, backgroundImage: `url(${image})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexGrow: 1 }} />
      )}
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#fff", marginTop: 90, textAlign: "center", wordBreak: "keep-all", lineHeight: 1.3, fontFamily: "Pretendard" }}>{title}</div>
      {sub ? (
        <div style={{ display: "flex", fontSize: 40, color: T.BODY, marginTop: 28, textAlign: "center", wordBreak: "keep-all", fontFamily: "Pretendard" }}>{sub}</div>
      ) : null}
      <div style={{ display: "flex", flexGrow: 1 }} />
      <div style={{ display: "flex", fontSize: 30, color: T.SUB }}>AI 스펙 광고 (팬메이드) · 브랜드 공식 광고가 아닙니다</div>
      <div style={{ display: "flex", fontSize: 34, color: T.ACCENT, fontWeight: 600, marginTop: 22 }}>{handle} · 매주 월요일 7:30</div>
    </div>
  )
}
