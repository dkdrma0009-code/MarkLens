import { random } from "remotion"
import type { Slide } from "@/lib/cardnews/types"
import type { ReelPhoto } from "@/lib/shorts/reel-photos"

/* ── 시네마틱 릴스 장면 ──
   make-cinematic-photo-reel 스킬(render_reel.py)의 룩을 Remotion으로 이식.
   원본이 PIL로 픽셀 연산하던 것을 SVG 필터로 **같은 수식** 그대로 구현한다.

   grade  : 휘도 가중 스플릿 토닝 → feColorMatrix 1장 (아래 GRADE_MATRIX 주석 참고)
   grain  : 가우시안 σ=8 → feTurbulence (분포는 다름, 진폭만 맞춤 — 아래 주석)
   vignette: 1 - 0.35·d^2.2 → 수식으로 계산한 radial-gradient 정지점
   kenburns: 1.25배 베이스에서 크롭 → 125% 컨테이너를 축소 (원본과 같이 다운샘플)
*/

const W = 1080
const H = 1920

// 원본 config.example.json 의 기본 grade 값
const GRADE = { warmth: 1.1, tealShadows: 0.14, saturation: 1.06, contrast: 1.1, vignette: 0.35 }
const GRAIN_SIGMA = 8      // 원본 add_grain 의 σ (0~255 스케일)
const FADE_SECONDS = 0.4
const BASE_SCALE = 1.25    // 원본 fit_cover(img, W*1.25, H*1.25)

const CONTAINER: React.CSSProperties = {
  width: W, height: H, display: "flex", position: "relative", overflow: "hidden",
  background: "#08080A", fontFamily: "Pretendard",
}

/* ── 컬러 그레이딩 행렬 ──
   원본(render_reel.py color_grade):
     lum = 0.299r + 0.587g + 0.114b
     r' = r + lum·kR                     kR = 14·warmth/255
     g' = g + lum·kG + (1-lum)·tG        kG =  4·warmth/255,  tG = 10·teal/255
     b' = b - lum·kB + (1-lum)·tB        kB = 10·warmth/255,  tB = 22·teal/255

   lum 을 전개하면 R·G·B 에 대해 선형이므로 feColorMatrix 한 장으로 정확히 떨어진다.
     r' = r(1 + .299kR) + g(.587kR) + b(.114kR)
     g' = r(.299·dG)    + g(1 + .587·dG) + b(.114·dG) + tG     dG = kG - tG
     b' = r(-.299·dB)   + g(-.587·dB)    + b(1 - .114·dB) + tB dB = kB + tB

   이전 버전은 반투명 레이어 2장을 화면 전체에 덮는 방식이라 휘도 구분이 없었다.
   그러면 스플릿 토닝(밝은 곳 따뜻·어두운 곳 청록)이 아니라 그냥 색 필터가 된다. */
function gradeMatrix(): string {
  const w = GRADE.warmth, t = GRADE.tealShadows
  const kR = (14 * w) / 255, kG = (4 * w) / 255, kB = (10 * w) / 255
  const tG = (10 * t) / 255, tB = (22 * t) / 255
  const dG = kG - tG, dB = kB + tB
  const L = [0.299, 0.587, 0.114]
  return [
    1 + L[0] * kR, L[1] * kR, L[2] * kR, 0, 0,
    L[0] * dG, 1 + L[1] * dG, L[2] * dG, 0, tG,
    -L[0] * dB, -L[1] * dB, 1 - L[2] * dB, 0, tB,
    0, 0, 0, 1, 0,
  ].map(n => n.toFixed(6)).join(" ")
}

/* 비네트 — 원본 mask = 1 - strength·d^2.2.
   d 는 정규화된 타원 거리라 화면 모서리에서 √2. radial-gradient 의 100% 가
   farthest-corner(=√2)이므로 정지점 p 에서 d = √2·p 로 두고 수식을 그대로 계산한다. */
function vignetteStops(): string {
  const stops = [0, 0.2, 0.4, 0.6, 0.8, 1].map(p => {
    const d = Math.SQRT2 * p
    const a = Math.min(1, GRADE.vignette * Math.pow(d, 2.2))
    return `rgba(0,0,0,${a.toFixed(4)}) ${(p * 100).toFixed(0)}%`
  })
  return stops.join(", ")
}

const GRADE_MATRIX = gradeMatrix()
const VIGNETTE = `radial-gradient(ellipse farthest-corner at center, ${vignetteStops()})`

/** 그레이딩 필터 정의. 원본 순서(contrast → saturation → grade)를 지킨다. */
function gradeFilterDefs(id: string) {
  const c = GRADE.contrast
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB">
          {/* PIL ImageEnhance.Contrast — 중간값 기준 선형 확장 */}
          <feComponentTransfer>
            <feFuncR type="linear" slope={c} intercept={(1 - c) / 2} />
            <feFuncG type="linear" slope={c} intercept={(1 - c) / 2} />
            <feFuncB type="linear" slope={c} intercept={(1 - c) / 2} />
          </feComponentTransfer>
          <feColorMatrix type="saturate" values={String(GRADE.saturation)} />
          <feColorMatrix type="matrix" values={GRADE_MATRIX} />
        </filter>
      </defs>
    </svg>
  )
}

/** 켄번즈 — 원본은 1.25배 베이스를 zW 로 축소한 뒤 W 를 크롭한다(항상 다운샘플 → 선명).
 *  여기서도 컨테이너를 125% 로 잡고 z/1.25 로 축소해 같은 샘플링 경로를 만든다. */
function kenBurns(t: number, zoomFrom: number, zoomTo: number, pan: [number, number]) {
  const z = zoomFrom + (zoomTo - zoomFrom) * t
  const maxX = (W * (z - 1)) / 2
  const maxY = (H * (z - 1)) / 2
  const s = z / BASE_SCALE
  return {
    width: `${BASE_SCALE * 100}%`,
    height: `${BASE_SCALE * 100}%`,
    marginLeft: `${((1 - BASE_SCALE) / 2) * 100}%`,
    marginTop: `${((1 - BASE_SCALE) / 2) * 100}%`,
    transform: `scale(${s}) translate(${(-pan[0] * (t - 0.5) * maxX) / s}px, ${(-pan[1] * (t - 0.5) * maxY) / s}px)`,
  }
}

/** 필름 그레인.
 *  ⚠️ 원본은 가우시안 노이즈(σ=8)를 픽셀값에 더한다. feTurbulence 는 정규분포가
 *  아니라 프랙탈 노이즈라 분포가 다르다. 진폭만 σ/255 에 맞춰 근사한 것이고,
 *  seed 를 프레임마다 바꿔 정지 패턴이 아닌 실제 필름처럼 지글거리게 한다. */
function grain(frame: number) {
  const seed = Math.floor(random(`grain-${frame}`) * 100000)
  const id = `grain-${frame}`
  const amp = GRAIN_SIGMA / 255
  return (
    <div key="grain" style={{
      position: "absolute", inset: 0, display: "flex",
      mixBlendMode: "overlay", opacity: 0.42,
    }}>
      <svg width={W} height={H} style={{ display: "flex" }} aria-hidden>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
          {/* 0~1 노이즈를 0.5 중심 ±amp 로 눌러 원본 σ 진폭에 맞춘다 */}
          <feComponentTransfer>
            <feFuncR type="linear" slope={amp * 4} intercept={0.5 - amp * 2} />
            <feFuncG type="linear" slope={amp * 4} intercept={0.5 - amp * 2} />
            <feFuncB type="linear" slope={amp * 4} intercept={0.5 - amp * 2} />
          </feComponentTransfer>
        </filter>
        <rect width={W} height={H} filter={`url(#${id})`} />
      </svg>
    </div>
  )
}

/** 스테이지드 타이틀 — 원본은 중앙 정렬, y=H*0.40, 앞 33% 페이드인 / 뒤 25% 페이드아웃 */
function title(text: string, sub: string | null, t: number) {
  const a = t < 0.33 ? t / 0.33 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1
  if (a <= 0.01) return null
  return (
    <div key="title" style={{
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start", paddingTop: H * 0.4,
      paddingLeft: 90, paddingRight: 90,
    }}>
      <div style={{
        display: "flex", fontSize: H * 0.075, fontWeight: 700, color: "#F5F0E6",
        letterSpacing: "-0.01em", opacity: a, textShadow: "2px 2px 0 rgba(0,0,0,0.5)",
        textAlign: "center", wordBreak: "keep-all", lineHeight: 1.2,
      }}>
        {text}
      </div>
      {sub && (
        <div style={{
          display: "flex", fontSize: H * 0.032, color: "#E6E1D7", marginTop: H * 0.06,
          opacity: a * 0.9, textAlign: "center", wordBreak: "keep-all", lineHeight: 1.5,
          textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

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
  const zoomFrom = zoomIn ? 1.05 : 1.12
  const zoomTo = zoomIn ? 1.14 : 1.04
  const pans: [number, number][] = [[0, 0.4], [0.5, 0], [-0.4, 0.2], [0, -0.3]]
  const pan = pans[index % pans.length]
  const { title: tt, sub } = slideTitle(slide, category)
  const filterId = `cine-grade-${index}`

  return (
    <div style={CONTAINER}>
      {gradeFilterDefs(filterId)}
      <div style={{ position: "absolute", inset: 0, display: "flex", overflow: "hidden" }}>
        <div style={{
          display: "flex",
          ...(photo
            ? { backgroundImage: `url(${photo.url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(160deg, #1a1a20 0%, #08080A 70%)" }),
          filter: `url(#${filterId})`,
          ...kenBurns(t, zoomFrom, zoomTo, pan),
        }} />
      </div>
      <div key="vig" style={{ position: "absolute", inset: 0, display: "flex", background: VIGNETTE }} />
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
