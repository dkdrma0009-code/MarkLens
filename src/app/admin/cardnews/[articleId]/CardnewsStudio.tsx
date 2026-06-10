"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Download, Sparkles, Copy, Check } from "lucide-react"
import type { Slide, CoverSlide, KeywordsSlide } from "@/lib/cardnews/types"

const SLIDE_NAMES = ["표지", "무슨 일?", "왜 중요한가", "당장 해볼 것", "키워드", "CTA"]

interface Props {
  articleId: string
  initialSlides: Slide[] | null
  initialCategory: string
}

export default function CardnewsStudio({ articleId, initialSlides, initialCategory }: Props) {
  const [slides, setSlides] = useState<Slide[] | null>(initialSlides)
  const [category, setCategory] = useState(initialCategory)
  const [warnings, setWarnings] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0) // 이미지 캐시버스트
  const [copied, setCopied] = useState(false)

  async function generateAll() {
    setGenerating(true)
    try {
      const res = await fetch("/api/admin/cardnews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSlides(data.slides)
      setCategory(data.category ?? category)
      setWarnings(data.warnings ?? [])
      setVersion(v => v + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : "생성 실패")
    } finally {
      setGenerating(false)
    }
  }

  async function regenerateOne(i: number) {
    setRegenIdx(i)
    try {
      const res = await fetch("/api/admin/cardnews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, slide: i + 1 }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSlides(data.slides)
      setWarnings(data.warnings ?? [])
      setVersion(v => v + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : "재생성 실패")
    } finally {
      setRegenIdx(null)
    }
  }

  async function save(next: Slide[]) {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/cardnews/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, slides: next, category }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setWarnings(data.warnings ?? [])
      setVersion(v => v + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패")
    } finally {
      setSaving(false)
    }
  }

  function update(i: number, patch: Partial<Slide>) {
    if (!slides) return
    const next = slides.map((s, j) => (j === i ? ({ ...s, ...patch } as Slide) : s))
    setSlides(next)
  }

  async function copyCaption() {
    const tag = category.replace(/\s+/g, "")
    const caption = `이 얘기, 면접에서 어떻게 말할까?\n\n"면접에서 이렇게 말해보세요" 풀버전은 프로필 링크에서 👀\n\n#마케팅 #${tag} #마케팅트렌드 #마케팅공부 #취준 #마케터 #MarkLens`
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  return (
    <div>
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={generateAll}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {slides ? "전체 다시 생성" : "카드뉴스 생성"}
        </button>

        {slides && (
          <>
            <a
              href={`/api/admin/cardnews/download?articleId=${articleId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              <Download className="w-4 h-4" /> 전체 다운로드 (ZIP)
            </a>
            <button
              onClick={copyCaption}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              권장 캡션 복사
            </button>
            {saving && <span className="text-xs text-muted-foreground">저장 중...</span>}
          </>
        )}
      </div>

      {/* 검증 경고 */}
      {warnings.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900 p-4">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">글자수 초과 — 디자인이 깨질 수 있어요. 수정 후 저장하세요.</p>
          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
            {warnings.map((w, i) => <li key={i}>· {w}</li>)}
          </ul>
        </div>
      )}

      {!slides && !generating && (
        <div className="border border-dashed border-border rounded-xl p-16 text-center text-sm text-muted-foreground">
          아직 카드뉴스가 없습니다. [카드뉴스 생성]을 눌러 시작하세요.
        </div>
      )}

      {generating && !slides && (
        <div className="border border-border rounded-xl p-16 text-center text-sm text-muted-foreground">
          AI가 6장 분량 카피를 뽑는 중... (약 10초)
        </div>
      )}

      {/* 6장 그리드 */}
      {slides && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {slides.map((s, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/admin/cardnews/render?articleId=${articleId}&slide=${i + 1}&v=${version}`}
                alt={`slide ${i + 1}`}
                className="w-full aspect-[4/5] object-cover bg-black"
              />
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground">{i + 1}. {SLIDE_NAMES[i]}</p>
                  <button
                    onClick={() => regenerateOne(i)}
                    disabled={regenIdx !== null}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                  >
                    {regenIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    이 장만 재생성
                  </button>
                </div>
                <SlideEditor slide={s} onChange={patch => update(i, patch)} onBlur={() => save(slides)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* 슬라이드 타입별 인라인 에디터 */
function SlideEditor({ slide, onChange, onBlur }: {
  slide: Slide
  onChange: (patch: Partial<Slide>) => void
  onBlur: () => void
}) {
  const cls = "w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-foreground/40 transition-colors"

  switch (slide.type) {
    case "cover": {
      const s = slide as CoverSlide
      return (
        <div className="space-y-1.5">
          {s.headline.map((line, i) => (
            <input key={i} value={line} placeholder={`헤드라인 ${i + 1}줄 (≤12자)`} className={cls}
              onChange={e => onChange({ headline: s.headline.map((l, j) => j === i ? e.target.value : l) } as Partial<Slide>)}
              onBlur={onBlur} />
          ))}
          <input value={s.highlight ?? ""} placeholder="강조 단어" className={cls}
            onChange={e => onChange({ highlight: e.target.value } as Partial<Slide>)} onBlur={onBlur} />
          <input value={s.sub ?? ""} placeholder="서브 (≤18자)" className={cls}
            onChange={e => onChange({ sub: e.target.value } as Partial<Slide>)} onBlur={onBlur} />
        </div>
      )
    }
    case "keywords": {
      const s = slide as KeywordsSlide
      return (
        <div className="space-y-1.5">
          {s.keywords.map((k, i) => (
            <div key={i} className="flex gap-1.5">
              <input value={k.word} placeholder="키워드 (≤12자)" className={cls}
                onChange={e => onChange({ keywords: s.keywords.map((x, j) => j === i ? { ...x, word: e.target.value } : x) } as Partial<Slide>)}
                onBlur={onBlur} />
              <input value={k.desc ?? ""} placeholder="설명 (≤22자)" className={cls}
                onChange={e => onChange({ keywords: s.keywords.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) } as Partial<Slide>)}
                onBlur={onBlur} />
            </div>
          ))}
        </div>
      )
    }
    case "why":
    case "cta":
      return (
        <div className="space-y-1.5">
          <input value={slide.headline} placeholder={slide.type === "why" ? "헤드라인 (≤16자)" : "헤드라인"} className={cls}
            onChange={e => onChange({ headline: e.target.value } as Partial<Slide>)} onBlur={onBlur} />
          <textarea value={slide.body} rows={3} placeholder="본문" className={cls}
            onChange={e => onChange({ body: e.target.value } as Partial<Slide>)} onBlur={onBlur} />
        </div>
      )
    case "fact":
      return (
        <div className="space-y-1.5">
          <textarea value={slide.body} rows={3} placeholder="본문 (≤90자)" className={cls}
            onChange={e => onChange({ body: e.target.value } as Partial<Slide>)} onBlur={onBlur} />
          <input value={slide.source ?? ""} placeholder="출처" className={cls}
            onChange={e => onChange({ source: e.target.value } as Partial<Slide>)} onBlur={onBlur} />
        </div>
      )
    case "apply":
      return (
        <textarea value={slide.body} rows={3} placeholder="본문 (≤80자)" className={cls}
          onChange={e => onChange({ body: e.target.value } as Partial<Slide>)} onBlur={onBlur} />
      )
  }
}
