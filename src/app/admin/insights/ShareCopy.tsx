"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Share2, Copy, X } from "lucide-react"

interface Props {
  hook?: string | null
  summary?: string | null
  slug: string
  category?: string | null
  tags?: string[] | null
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"

// 태그·카테고리 → 해시태그 (공백 제거, 최대 5개, #마케팅·#MarkLens 고정)
function hashtags(category?: string | null, tags?: string[] | null): string {
  const raw = [category, ...(tags ?? [])].filter(Boolean) as string[]
  const tagSet = new Set<string>(["마케팅"])
  for (const t of raw) {
    const clean = t.replace(/[\s#]+/g, "")
    if (clean) tagSet.add(clean)
    if (tagSet.size >= 4) break
  }
  tagSet.add("MarkLens")
  return [...tagSet].map(t => `#${t}`).join(" ")
}

export default function ShareCopy({ hook, summary, slug, category, tags }: Props) {
  const [open, setOpen] = useState(false)
  const url = `${SITE}/insights/${slug}`
  const tagLine = hashtags(category, tags)
  const title = hook || "MarkLens 인사이트"

  // 링크드인: 훅 + 요약 + 링크 + 해시태그 (조금 길어도 OK)
  const linkedin = `${title}\n\n${summary ?? ""}\n\n▶ 전문 보기: ${url}\n\n${tagLine}`.trim()
  // 스레드/X: 짧게 — 훅 + 링크 + 해시태그
  const threads = `${title}\n\n${url}\n${tagLine}`.trim()

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} 카피 복사됨`)
    } catch {
      toast.error("복사 실패 — 직접 선택해 복사해주세요")
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="공유 카피"
        aria-label="공유 카피 생성"
      >
        <Share2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">공유 카피</h3>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">링크드인</span>
                  <button onClick={() => copy(linkedin, "링크드인")} className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:opacity-70">
                    <Copy className="w-3 h-3" /> 복사
                  </button>
                </div>
                <textarea readOnly value={linkedin} rows={6}
                  className="w-full text-sm p-3 rounded-lg border border-border bg-muted/30 resize-none focus:outline-none" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">스레드 / X</span>
                  <button onClick={() => copy(threads, "스레드")} className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:opacity-70">
                    <Copy className="w-3 h-3" /> 복사
                  </button>
                </div>
                <textarea readOnly value={threads} rows={4}
                  className="w-full text-sm p-3 rounded-lg border border-border bg-muted/30 resize-none focus:outline-none" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4">붙여넣은 뒤 한두 줄 직접 다듬으면 더 자연스러워요.</p>
          </div>
        </div>
      )}
    </>
  )
}
