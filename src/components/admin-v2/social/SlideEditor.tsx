"use client"
import type { Slide, CoverSlide, KeywordsSlide } from "@/lib/cardnews/types"
/* 슬라이드 타입별 인라인 에디터 */
export default function SlideEditor({ slide, onChange, onBlur, onCommit }: {
  slide: Slide
  onChange: (patch: Partial<Slide>) => void
  onBlur: () => void
  onCommit: (patch: Partial<Slide>) => void
}) {
  const cls = "w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:border-foreground/40 transition-colors"

  switch (slide.type) {
    case "cover": {
      const s = slide as CoverSlide
      return (
        <div className="space-y-1.5">
          {s.headline.map((line, i) => (
            <input key={i} value={line} placeholder={`헤드라인 ${i + 1}줄 (${slide.role ? "공식명 유지" : "≤12자"})`} className={cls}
              onChange={e => onChange({ headline: s.headline.map((l, j) => j === i ? e.target.value : l) } as Partial<Slide>)}
              onBlur={onBlur} />
          ))}
          {!slide.role ? <input value={s.highlight ?? ""} placeholder="강조 단어" className={cls}
            onChange={e => onChange({ highlight: e.target.value } as Partial<Slide>)} onBlur={onBlur} /> : null}
          {!slide.role ? <input value={s.sub ?? ""} placeholder="서브 (≤18자)" className={cls}
            onChange={e => onChange({ sub: e.target.value } as Partial<Slide>)} onBlur={onBlur} /> : null}
          <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={s.usePhoto !== false}
              onChange={e => onCommit({ usePhoto: e.target.checked } as Partial<Slide>)}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
            사진 표지 사용 (기본 — 이미지 없으면 자동 타이포 폴백)
          </label>
          {slide.role ? <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={s.photoCrop === true}
              onChange={e => onCommit({ photoCrop: e.target.checked } as Partial<Slide>)} />
            중앙 crop 사용 — 얼굴·로고·제품을 검수한 경우만
          </label> : null}
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
