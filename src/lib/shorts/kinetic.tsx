import { interpolate, spring } from "remotion"
import type { ReelBeat } from "./reel-script"

/* 키네틱 타이포그래피 릴스 씬 — 사진 없이 대본 비트 하나를 화면 가득 움직이는
   글자로 전개한다. "정지 슬라이드쇼 탈출"이라는 벤치마킹 결론에 맞춰, 각 비트의
   role 이 모션·색·정렬을 전부 분기한다.

   기존 카드뉴스/시네마틱 씬들과 달리 useCurrentFrame 을 쓰지 않고 frame 을 인자로
   받는다(코드베이스 렌더 함수 규약). 그래서 Player 미리보기와 Lambda 렌더가 같은
   프레임에 같은 그림을 낸다. */

const T = {
  BG: "#0A0A0A",
  TEXT: "#FFFFFF",
  BODY: "#EAEAEA",
  SUB: "#8A8A8A",
  ACCENT: "#6366F1",   // 사이트 indigo-500
  ACCENT_HI: "#A5B4FC", // indigo-300, 어두운 바탕에서 글자 강조용
  FONT: "Pretendard",
  W: 1080,
  H: 1920,
  PAD: 120,
}
const FPS = 30
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const }
const EXIT = 8 // 비트 끝 페이드 (0.27s)

type Role = ReelBeat["role"]

// 글자 크기 — 글자 수로 정한다. role 별 상한을 달리 줘서 hook 은 크게 때리고
// insight 는 읽히게 낮춘다. 한 호흡(15~45자) 기준으로 튜닝.
function fitSize(text: string, max: number): number {
  const n = text.replace(/\s/g, "").length
  const raw = n <= 8 ? max : n <= 14 ? max * 0.82 : n <= 22 ? max * 0.64 : n <= 32 ? max * 0.5 : max * 0.4
  return Math.round(raw)
}

// 강조 단어 판정 — emphasis 문구를 공백으로 쪼갠 집합에, 문장부호 제거한 단어가
// 들어가면 강조. 한국어 조사까지 정확히 맞추긴 어려우니 "포함"으로 느슨하게 잡되,
// emphasis 가 text 에 실제로 있을 때만(생성기에서 이미 검증) 동작한다.
function emphasisSet(emphasis?: string): Set<string> {
  if (!emphasis) return new Set()
  return new Set(emphasis.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean))
}
function isEm(word: string, set: Set<string>): boolean {
  if (!set.size) return false
  const w = word.replace(/[^\p{L}\p{N}]/gu, "")
  return !!w && (set.has(w) || [...set].some(e => w.includes(e) || e.includes(w)))
}

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

// role 별 배경 — 근검정 위에 옅은 방사형 글로우. 정지 화면이라도 색으로 리듬을 준다.
function bgFor(role: Role, frame: number, duration: number): React.CSSProperties {
  const glow = (x: number, y: number, c: string, size: number) =>
    `radial-gradient(${size}% ${size}% at ${x}% ${y}%, ${c} 0%, rgba(0,0,0,0) 60%)`
  const base: Record<Role, string> = {
    hook: glow(50, 30, "rgba(99,102,241,0.22)", 90),
    tension: glow(30, 78, "rgba(99,102,241,0.10)", 100),
    insight: glow(50, 45, "rgba(99,102,241,0.08)", 85),
    payoff: glow(50, 45, "rgba(99,102,241,0.28)", 95),
    outro: glow(50, 50, "rgba(99,102,241,0.06)", 70),
  }
  return {
    position: "absolute",
    inset: 0,
    background: `${base[role]}, ${T.BG}`,
    // 정적 비네트 — 매 프레임 필터가 아니라 그라디언트라 렌더 부담 없음
    boxShadow: "inset 0 0 320px 80px rgba(0,0,0,0.55)",
  }
}

// 단어 스태거 등장 — 각 단어가 delay 를 두고 스프링으로 올라온다.
function wordSpring(frame: number, i: number, step: number, delay0: number, cfg: { damping: number; stiffness: number; mass: number }) {
  return spring({ frame: frame - delay0 - i * step, fps: FPS, config: cfg })
}

// transparent: 영상 위에 얹을 때. 불투명 배경·비네트를 빼고 글자에 그림자를 넣어
// b-roll 위에서도 읽히게 한다.
export function renderKineticScene(beat: ReelBeat, frame: number, duration: number, index: number, opts: { transparent?: boolean } = {}): React.JSX.Element {
  const set = emphasisSet(beat.emphasis)
  const ws = words(beat.text)
  const exitOp = interpolate(frame, [duration - EXIT, duration], [1, 0], clamp)
  const overlay = !!opts.transparent
  const textShadow = overlay ? "0 2px 28px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95)" : undefined

  const container: React.CSSProperties = {
    width: T.W, height: T.H, position: "relative", overflow: "hidden",
    fontFamily: T.FONT, background: overlay ? "transparent" : T.BG,
  }

  // ── role 별 파라미터 ──
  const spec = {
    hook:    { size: 158, weight: 800, align: "center" as const, justify: "center" as const, step: 2.5, spring: { damping: 15, stiffness: 200, mass: 0.8 }, rise: 54, punch: 0.7, color: T.TEXT },
    tension: { size: 118, weight: 700, align: "left" as const,   justify: "flex-end" as const, step: 3, spring: { damping: 22, stiffness: 170, mass: 0.9 }, rise: 40, punch: 0.9, color: T.BODY },
    insight: { size: 122, weight: 700, align: "left" as const,   justify: "center" as const, step: 2, spring: { damping: 24, stiffness: 210, mass: 0.7 }, rise: 34, punch: 0.92, color: T.TEXT },
    payoff:  { size: 168, weight: 800, align: "center" as const, justify: "center" as const, step: 2.5, spring: { damping: 14, stiffness: 190, mass: 0.85 }, rise: 30, punch: 0.6, color: T.TEXT },
    outro:   { size: 110, weight: 600, align: "center" as const, justify: "center" as const, step: 3.5, spring: { damping: 26, stiffness: 150, mass: 1 }, rise: 24, punch: 1, color: T.BODY },
  }[beat.role]

  const fontSize = fitSize(beat.text, spec.size)
  const lastWordDelay = (ws.length - 1) * spec.step

  // payoff 는 진입 순간 인디고 플래시로 "한 방" 준다
  const flash = beat.role === "payoff"
    ? interpolate(frame, [0, 5, 11], [0.5, 0.14, 0], { ...clamp })
    : 0

  const textBlock = (
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      flexDirection: "column", justifyContent: spec.justify,
      alignItems: spec.align === "center" ? "center" : "flex-start",
      padding: `${T.PAD}px ${T.PAD}px`, boxSizing: "border-box",
    }}>
      {/* role 라벨(kicker) — hook·payoff 는 없고, tension/insight/outro 에만 얇게 */}
      {beat.role === "tension" && (
        <Kicker frame={frame} text="그런데" />
      )}
      <div style={{
        display: "flex", flexWrap: "wrap",
        justifyContent: spec.align === "center" ? "center" : "flex-start",
        gap: `${Math.round(fontSize * 0.12)}px ${Math.round(fontSize * 0.28)}px`,
        textAlign: spec.align, lineHeight: 1.08, maxWidth: T.W - T.PAD * 2,
      }}>
        {ws.map((w, i) => {
          const s = wordSpring(frame, i, spec.step, 2, spec.spring)
          const em = isEm(w, set)
          const y = (1 - s) * spec.rise
          const sc = spec.punch + (1 - spec.punch) * s
          // payoff 강조 단어는 더 크게
          const emScale = beat.role === "payoff" && em ? 1.18 : 1
          return (
            <span key={i} style={{ display: "inline-block", position: "relative" }}>
              <span style={{
                display: "inline-block",
                fontSize: fontSize * emScale,
                fontWeight: em ? 800 : spec.weight,
                color: em ? T.ACCENT_HI : spec.color,
                opacity: s,
                transform: `translateY(${y}px) scale(${sc})`,
                letterSpacing: beat.role === "outro" ? "0.04em" : "-0.02em",
                whiteSpace: "pre",
                textShadow,
              }}>{w}</span>
              {/* insight/hook 강조 단어 밑줄이 왼→오 그려진다 */}
              {em && (beat.role === "insight" || beat.role === "hook") && (
                <span style={{
                  position: "absolute", left: 0, bottom: -Math.round(fontSize * 0.14),
                  height: Math.max(4, Math.round(fontSize * 0.06)), width: "100%",
                  background: T.ACCENT, borderRadius: 4, transformOrigin: "left center",
                  transform: `scaleX(${interpolate(frame, [2 + i * spec.step + 6, 2 + i * spec.step + 16], [0, 1], clamp)})`,
                }} />
              )}
            </span>
          )
        })}
      </div>
    </div>
  )

  return (
    <div style={{ ...container, opacity: exitOp }}>
      {!overlay && <div style={bgFor(beat.role, frame, duration)} />}
      {flash > 0 && <div style={{ position: "absolute", inset: 0, background: T.ACCENT, opacity: flash }} />}
      {textBlock}
      {beat.role === "outro" && <Wordmark frame={frame} lastDelay={lastWordDelay} />}
      {/* 우하단 진행 점(현재 비트 위치는 컴포지션에서 전달하는 index/총개수로) */}
    </div>
  )
}

// 작은 상단 라벨 — 페이드+살짝 상승
function Kicker({ frame, text }: { frame: number; text: string }) {
  const op = interpolate(frame, [0, 10], [0, 1], clamp)
  const y = interpolate(frame, [0, 10], [12, 0], clamp)
  return (
    <div style={{
      marginBottom: 28, display: "flex", alignItems: "center", gap: 16,
      opacity: op, transform: `translateY(${y}px)`,
    }}>
      <div style={{ width: 40, height: 3, background: T.ACCENT, borderRadius: 2 }} />
      <span style={{ fontSize: 34, fontWeight: 600, color: T.SUB, letterSpacing: "0.02em" }}>{text}</span>
    </div>
  )
}

// 아웃트로 워드마크 — 글자 다 뜬 뒤 아래에서 조용히
function Wordmark({ frame, lastDelay }: { frame: number; lastDelay: number }) {
  const start = 2 + lastDelay + 6
  const op = interpolate(frame, [start, start + 12], [0, 1], clamp)
  const y = interpolate(frame, [start, start + 12], [16, 0], clamp)
  return (
    <div style={{
      position: "absolute", bottom: 140, left: 0, right: 0, textAlign: "center",
      opacity: op, transform: `translateY(${y}px)`,
    }}>
      <span style={{ fontSize: 40, fontWeight: 700, color: T.ACCENT_HI, letterSpacing: "0.18em" }}>MARKLENS</span>
    </div>
  )
}

// 진행 인디케이터 — 화면 하단, 현재 비트까지 채워진 얇은 바
export function renderProgress(index: number, count: number): React.JSX.Element {
  return (
    <div style={{ position: "absolute", bottom: 70, left: T.PAD, right: T.PAD, display: "flex", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= index ? T.ACCENT : "rgba(255,255,255,0.16)",
        }} />
      ))}
    </div>
  )
}
