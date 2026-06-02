export const CATEGORY_META: Record<string, { color: string; gradient: string; emoji: string }> = {
  "브랜딩":           { color: "#6366f1", gradient: "from-indigo-500 to-violet-600",  emoji: "✦" },
  "퍼포먼스 마케팅":  { color: "#f59e0b", gradient: "from-amber-400 to-orange-500",   emoji: "⚡" },
  "CRM":              { color: "#10b981", gradient: "from-emerald-400 to-teal-600",   emoji: "◈" },
  "콘텐츠 마케팅":    { color: "#8b5cf6", gradient: "from-violet-500 to-purple-700",  emoji: "✎" },
  "SEO":              { color: "#3b82f6", gradient: "from-blue-400 to-blue-600",      emoji: "◎" },
  "소셜 미디어":      { color: "#ec4899", gradient: "from-pink-400 to-rose-600",      emoji: "◐" },
  "AI 마케팅":        { color: "#06b6d4", gradient: "from-cyan-400 to-sky-600",       emoji: "◈" },
  "소비자 심리":      { color: "#ef4444", gradient: "from-red-400 to-rose-600",       emoji: "◉" },
}

export function getCategoryMeta(category: string) {
  return CATEGORY_META[category] ?? { color: "#6b7280", gradient: "from-gray-400 to-gray-600", emoji: "·" }
}
