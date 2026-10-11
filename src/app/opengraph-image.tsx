import { ImageResponse } from "next/og"
import WordmarkSvg from "@/lib/brand/WordmarkSvg"

export const runtime = "edge"
export const alt = "MarkLens — Where Marketing Trends Become Action"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* 브랜드 상단 바 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "#164BFF",
          }}
        />

        {/* 로고 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <WordmarkSvg reverse width={290} />
        </div>

        {/* 메인 카피 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: 52,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.2,
            letterSpacing: -2,
            maxWidth: 900,
            marginBottom: 24,
          }}
        >
          <div>Where Marketing Trends</div>
          <div>Become Action</div>
        </div>

        {/* 서브 카피 */}
        <div
          style={{
            fontSize: 22,
            color: "#888",
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          글로벌 마케팅 인사이트를 분석해 실무에 바로 적용 가능한 형태로 전달합니다
        </div>

        {/* 하단 URL */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 18,
            color: "#555",
            letterSpacing: 1,
          }}
        >
          marklens.site
        </div>
      </div>
    ),
    { ...size }
  )
}
