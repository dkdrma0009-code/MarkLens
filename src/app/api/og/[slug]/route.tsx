import { ImageResponse } from "next/og"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "edge"

const CATEGORY_COLORS: Record<string, { from: string; to: string }> = {
  "브랜딩":          { from: "#6366f1", to: "#7c3aed" },
  "퍼포먼스 마케팅": { from: "#f59e0b", to: "#ea580c" },
  "CRM":             { from: "#10b981", to: "#0d9488" },
  "콘텐츠 마케팅":   { from: "#8b5cf6", to: "#6d28d9" },
  "SEO":             { from: "#3b82f6", to: "#1d4ed8" },
  "소셜 미디어":     { from: "#ec4899", to: "#e11d48" },
  "AI 마케팅":       { from: "#06b6d4", to: "#0284c7" },
  "소비자 심리":     { from: "#ef4444", to: "#dc2626" },
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("insights")
    .select("hook, category, article:articles(source_name)")
    .eq("slug", slug)
    .single()

  const hook = data?.hook ?? "MarkLens 인사이트"
  const category = data?.category ?? "마케팅"
  const source = (data?.article as { source_name?: string } | null)?.source_name ?? ""
  const colors = CATEGORY_COLORS[category] ?? { from: "#6366f1", to: "#4f46e5" }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: MarkLens label */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.2)",
              borderRadius: "999px",
              padding: "9px 21px",
              fontSize: "20px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "0.05em",
            }}
          >
            MARKLENS
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: "999px",
              padding: "9px 21px",
              fontSize: "20px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {category}
          </div>
        </div>

        {/* Center: Hook text */}
        <div
          style={{
            fontSize: hook.length > 30 ? "54px" : "66px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            maxWidth: "920px",
          }}
        >
          {hook}
        </div>

        {/* Bottom: source */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "22px", color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
            {source}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "12px",
              padding: "12px 24px",
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "white",
              }}
            />
            <span style={{ fontSize: "21px", color: "white", fontWeight: 700 }}>marklens.site</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
