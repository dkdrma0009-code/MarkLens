import { random } from "remotion"
import type { Slide } from "@/lib/cardnews/types"
import type { ReelPhoto } from "@/lib/shorts/reel-photos"

/* ── 시네마틱 릴스 장면 ──
   make-cinematic-photo-reel 스킬(render_reel.py)의 룩을 Remotion으로 옮긴 것.
   원본이 PIL로 픽셀 연산하던 걸 CSS/SVG 필터로 재현한다.

     color_grade  warm highlights + teal shadows  → 블렌드 레이어 + contrast/saturate
     add_grain    가우시안 노이즈 σ≈8             → feTurbulence, 프레임마다 seed 변경
     vignette     1 - 0.35·d^2.2                  → radial-gradient 오버레이
     ken_burns    zoom + pan                      → scale + translate
     타이틀 카드   중앙 정렬, 33%/75% 페이드        → 그대로
     fade_seconds 첫/끝 검정 페이드                → 검정 오버레이

   기존 릴스컷과 달리 텍스트가 화면 중앙에 오고, 사진이 배경 전체를 채운다. */

const W = 1080
const H = 1920

// 원본 config.example.json 의 기본 grade 값
const GRADE = { warmth: 1.1, tealShadows: 0.14, saturation: 1.06, contrast: 1.1, vignette: 0.35 }
const GRAIN = 8
const FADE_SECONDS = 0.4

const CONTAINER: React.CSSProperties = {
  width: W, height: H, display: "flex", position: "relative", overflow: "hidden",
  background: "#08080A", fontFamily: "Pretendard",
}

/** 켄번즈 — 원본은 오버사이즈 베이스에서 크롭했다. 여기서는 1.25배 컨테이너를
 *  scale+translate 로 움직여 같은 결과를 낸다. pan 은 [-1,1] 드리프트 방향. */
function kenBurns(t: number, zoomFrom: number, zoomTo: number, pan: [number, number]) {
  const z = zoomFrom + (zoomTo - zoomFrom) * t
  // 확대분의 절반이 이동 가능한 최대 거리 (원본의 max_dx/max_dy 와 같은 개념)
  const maxX = (W * (z - 1)) / 2
  const maxY = (H * (z - 1)) / 2
  return {
    transform: `scale(${z}) translate(${-pan[0] * (t - 0.5) * maxX / z}px, ${-pan[1] * (t - 0.5) * maxY / z}px)`,
  }
}

/** 필름 그레인 — feTurbulence 로 노이즈를 만들고 overlay 로 합성.
 *  seed 를 프레임마다 바꿔야 정지 패턴이 아니라 실제 필름처럼 지글거린다. */
function grain(frame: number) {
  const seed = Math.floor(random(`grain-${frame}`) * 10000)
  const id = `grain-${frame}`
  return (
    <div key="grain" style={{
      position: "absolute", inset: 0, display: "flex",
      mixBlendMode: "overlay", opacity: GRAIN / 24,
    }}>
      <svg width={W} height={H} style={{ display: "flex" }}>
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={W} height={H} filter={`url(#${id})`} />
      </svg>
    </div>
  )
}

/** 틸-오렌지 그레이딩 — 원본은 휘도 기반으로 하이라이트를 덥히고 섀도우에 청록을 넣었다.
 *  CSS 블렌드로 근사한다: screen 으로 하이라이트 온기, multiply 로 섀도우 청록. */
function grade() {
  const warmA = 0.055 * GRADE.warmth
  const tealA = 0.16 * GRADE.tealShadows
  return [
    <div key="warm" style={{
      position: "absolute", inset: 0, display: "flex",
      background: `rgba(255, 170, 90, ${warmA})`, mixBlendMode: "screen",
    }} />,
    <div key="teal" style={{
      position: "absolute", inset: 0, display: "flex",
      background: `rgba(120, 210, 230, ${tealA})`, mixBlendMode: "multiply",
    }} />,
  ]
}

/** 비네트 — 원본 mask = 1 - strength·d^2.2 를 radial-gradient 로 근사 */
function vignette() {
  return (
    <div key="vig" style={{
      position: "absolute", inset: 0, display: "flex",
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,${GRADE.vignette * 0.62}) 78%, rgba(0,0,0,${GRADE.vignette}) 100%)`,
    }} />
  )
}

/** 스테이지드 타이틀 — 원본은 중앙 정렬, y=H*0.40, 앞 33% 페이드인 / 뒤 25% 페이드아웃 */
function title(text: string, sub: string | null, t: number) {
  const a = t < 0.33 ? t / 0.33 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1
  if (a <= 0.01) return null
  return (
    <div key="title" style={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start", paddingTop: H * 0.36,
    }}>
      <div style={{
        display: "flex", fontSize: H * 0.075, fontWeight: 700, color: "#F5F0E6",
        letterSpacing: "-0.01em", opacity: a, textShadow: "0 2px 6px rgba(0,0,0,0.55)",
        textAlign: "center", wordBreak: "keep-all", lineHeight: 1.2,
      }}>
        {text}
      </div>
      {sub && (
        <div style={{
          display: "flex", fontSize: H * 0.032, color: "#E6E1D7", marginTop: H * 0.035,
          opacity: a * 0.9, textShadow: "0 2px 5px rgba(0,0,0,0.5)", textAlign: "center",
          wordBreak: "keep-all", lineHeight: 1.5,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

/** 첫 장면 페이드인 / 마지막 장면 페이드아웃 (검정) */
function blackFade(frame: number, duration: number, fps: number, isFirst: boolean, isLast: boolean) {
  const f = FADE_SECONDS * fps
  let a = 0
  if (isFirst && frame < f) a = 1 - frame / f
  if (isLast && duration - frame < f) a = Math.max(a, 1 - (duration - frame) / f)
  if (a <= 0.01) return null
  return <div key="fade" style={{ position: "absolute", inset: 0, display: "flex", background: "#000", opacity: a }} />
}

function slideTitle(s: Slide, category: string): { title: string; sub: string | null } {
  switch (s.type) {
    case "cover":    return { title: s.headline.join(" "), sub: s.sub ?? null }
    case "why":      return { title: s.headline, sub: s.body }
    case "apply":    return { title: s.label ?? "당장 해볼 수 있는 것", sub: s.body }
    case "fact":     return { title: s.label ?? "무슨 일?", sub: s.body }
    case "keywords": return { title: s.label ?? "흐름", sub: s.keywords.map(k => k.word).join(" · ") }
    case "cta":      return { title: s.headline, sub: s.body }
    default:         return { title: category, sub: null }
  }
}

export function renderCinematicScene(
  slide: Slide, category: string, frame: number, duration: number, fps: number,
  index: number, isFirst: boolean, isLast: boolean, photo?: ReelPhoto,
): React.ReactElement {
  const t = duration <= 1 ? 0 : frame / (duration - 1)
  // 원본 지침: 장면마다 줌인/줌아웃을 번갈아 쓰고 팬 방향도 바꿔 숨이 트이게 한다
  const zoomIn = index % 2 === 0
  const zoomFrom = zoomIn ? 1.05 : 1.14
  const zoomTo = zoomIn ? 1.14 : 1.04
  const pans: [number, number][] = [[0, 0.4], [0.5, 0], [-0.4, 0.2], [0, -0.3]]
  const pan = pans[index % pans.length]
  const { title: tt, sub } = slideTitle(slide, category)

  return (
    <div style={CONTAINER}>
      <div style={{ position: "absolute", inset: 0, display: "flex", overflow: "hidden" }}>
        <div style={{
          width: "100%", height: "100%", display: "flex",
          ...(photo
            ? { backgroundImage: `url(${photo.url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(160deg, #1a1a20 0%, #08080A 70%)" }),
          filter: `contrast(${GRADE.contrast}) saturate(${GRADE.saturation})`,
          ...kenBurns(t, zoomFrom, zoomTo, pan),
        }} />
      </div>
      {grade()}
      {vignette()}
      {grain(frame)}
      {title(tt, sub, t)}
      {photo && (
        <div key="credit" style={{
          position: "absolute", bottom: 26, right: 60, display: "flex",
          fontSize: 22, color: "rgba(245,240,230,0.4)",
        }}>
          {`Photo: ${photo.credit} / Unsplash`}
        </div>
      )}
      <div key="wm" style={{
        position: "absolute", bottom: 26, left: 60, display: "flex",
        fontSize: 24, fontWeight: 600, color: "rgba(245,240,230,0.45)", letterSpacing: "0.14em",
      }}>
        MARKLENS
      </div>
      {blackFade(frame, duration, fps, isFirst, isLast)}
    </div>
  )
}

/** 엔딩 크레딧 카드 — 원본의 credit 장면 (검정 배경 + 중앙 텍스트 + 그레인) */
export function renderCreditScene(text: string, frame: number, duration: number): React.ReactElement {
  const t = duration <= 1 ? 0 : frame / (duration - 1)
  const a = Math.min(1, t / 0.3) * (t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3))
  return (
    <div style={{ ...CONTAINER, alignItems: "center", justifyContent: "center" }}>
      <div style={{
        display: "flex", fontSize: H * 0.04, color: `rgba(230,225,215,${a})`,
        letterSpacing: "0.02em",
      }}>
        {text}
      </div>
      {grain(frame)}
    </div>
  )
}
