"use client"
import { useRef, useState } from "react"
import { toast } from "sonner"
import type { Slide, CoverSlide } from "@/lib/cardnews/types"
import { ROLE_LABELS } from "@/lib/cardnews/editorial"
import SlideEditor from "@/components/admin-v2/social/SlideEditor"
import RenderImage from "@/components/admin-v2/social/RenderImage"
const SLIDE_NAMES = ["표지", "무슨 일?", "왜 중요한가", "당장 해볼 것", "키워드", "CTA"]

// AI 캡션이 없을 때의 폴백 (레퍼런스 구조 유지)
function defaultCaption(slides: Slide[] | null, category: string): string {
  const cover = slides?.[0]?.type === "cover" ? (slides[0] as CoverSlide) : null
  const headline = cover ? cover.headline.join(" ") : "이번 주 마케팅 인사이트"
  const tag = category.replace(/\s+/g, "")
  return `💬 ${headline}

이번 주 마케팅판에서 가장 눈에 띈 변화를 ${slides?.length ?? 6}장으로 정리했어요.
우리 브랜드라면 어떻게 적용해볼 수 있을까요?

"면접에서 이렇게 말해보세요" 풀버전은 프로필 링크에서 🔍

트렌드를 실전으로 바꾸는 마크렌즈 | @marklens 🔍

#마케팅 #${tag} #마케팅트렌드 #마케팅공부 #취준 #마케터 #MarkLens`
}

interface Props {
  articleId: string
  initialSlides: Slide[] | null
  initialCategory: string
  initialCaption?: string | null
  onSaved?: (slides: Slide[], caption: string) => void
}

export default function CardnewsStudio({ articleId, initialSlides, initialCategory, initialCaption, onSaved }: Props) {
  const lock = useRef(false)
  const [slides, setSlides] = useState<Slide[] | null>(initialSlides)
  const [category, setCategory] = useState(initialCategory)
  const [warnings, setWarnings] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [regenIdx, setRegenIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0) // 이미지 캐시버스트
  const [copied, setCopied] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(0) // 인스타 캐러셀 위치
  const [caption, setCaption] = useState(() => initialCaption || defaultCaption(initialSlides, initialCategory))

  async function generateAll() {
    if (lock.current) return
    lock.current = true
    setGenerating(true)
    try {
      const res = await fetch("/api/admin/cardnews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "요청 실패")
      setSlides(data.slides)
      setCategory(data.category ?? category)
      setWarnings(data.warnings ?? [])
      setVersion(v => v + 1)
      setPreviewIdx(0)
      const nextCaption = data.caption || defaultCaption(data.slides, data.category ?? category)
      setCaption(nextCaption)
      onSaved?.(data.slides, nextCaption)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패")
    } finally {
      lock.current = false
      setGenerating(false)
    }
  }

  async function regenerateOne(i: number) {
    if (lock.current) return
    lock.current = true
    setRegenIdx(i)
    try {
      const res = await fetch("/api/admin/cardnews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, slide: i + 1 }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "요청 실패")
      setSlides(data.slides)
      setWarnings(data.warnings ?? [])
      setVersion(v => v + 1)
      onSaved?.(data.slides, caption)
      toast.success("저장된 render가 갱신됐습니다.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "재생성 실패")
    } finally {
      lock.current = false
      setRegenIdx(null)
    }
  }

  async function save(next: Slide[]) {
    if (lock.current) return
    lock.current = true
    setSaving(true)
    try {
      const res = await fetch("/api/admin/cardnews/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, slides: next, category, caption }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "요청 실패")
      setWarnings(data.warnings ?? [])
      setVersion(v => v + 1)
      onSaved?.(next, caption)
      toast.success("저장된 render가 갱신됐습니다.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패")
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  function update(i: number, patch: Partial<Slide>) {
    if (!slides) return
    const next = slides.map((s, j) => (j === i ? ({ ...s, ...patch } as Slide) : s))
    setSlides(next)
  }

  // 토글류 — 변경 즉시 저장 + 리렌더 (blur 이벤트 없음)
  function commit(i: number, patch: Partial<Slide>) {
    if (!slides) return
    const next = slides.map((s, j) => (j === i ? ({ ...s, ...patch } as Slide) : s))
    setSlides(next)
    save(next)
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  const imgUrl = (i: number) => `/api/admin/cardnews/render?articleId=${articleId}&slide=${i + 1}&v=${version}`

  const busy = generating || saving || regenIdx !== null
  const selected = Math.min(previewIdx, Math.max(0, (slides?.length || 1) - 1))
  return <div className="social-carousel-studio">
    <div className="social-studio-toolbar"><button className="admin-control admin-primary" disabled={busy} onClick={generateAll}>{generating ? "생성 중…" : slides ? "전체 재생성" : "Carousel 생성"}</button>
      {slides && <><button className="admin-control" disabled={busy} onClick={() => save(slides)}>Save / Render</button><a className="admin-control" href={`/api/admin/cardnews/download?articleId=${articleId}`} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault() }}>다운로드 ZIP</a><span role="status" className="admin-note">{saving ? "저장 중…" : "Preview는 저장된 실제 render입니다."}</span></>}
    </div>
    {warnings.length > 0 && <div className="social-notice" role="alert"><strong>실제 validation 경고</strong><ul>{warnings.map((warning,i) => <li key={i}>{warning}</li>)}</ul></div>}
    {!slides ? <div className="admin-empty" role="status">{generating ? "기존 생성기가 콘텐츠에 맞는 slides를 생성하고 있습니다…" : "아직 Carousel이 없습니다. 생성 후 검수하세요."}</div> : <div className="social-carousel-layout">
      <nav className="social-scenes" aria-label="Carousel 장 선택"><p>SLIDES / {slides.length}</p>{slides.map((slide,i) => <button key={i} aria-current={selected === i ? "step" : undefined} onClick={() => setPreviewIdx(i)}><span>{String(i+1).padStart(2,"0")}</span><span>{slide.role ? ROLE_LABELS[slide.role] : SLIDE_NAMES[i] || slide.type}</span></button>)}</nav>
      <section className="social-canvas" aria-label="Carousel final render preview"><RenderImage key={`${selected}-${version}`} src={imgUrl(selected)} alt={`Carousel ${selected+1}장 실제 render`} /><div className="social-canvas-nav"><button className="admin-control" disabled={selected === 0} onClick={() => setPreviewIdx(selected-1)}>이전 장</button><span>{selected+1} / {slides.length}</span><button className="admin-control" disabled={selected+1 === slides.length} onClick={() => setPreviewIdx(selected+1)}>다음 장</button></div></section>
      <section className="social-editor" aria-label="Slide copy and settings"><div className="social-editor-heading"><h3>{String(selected+1).padStart(2,"0")} {slides[selected].role ? ROLE_LABELS[slides[selected].role!] : SLIDE_NAMES[selected] || slides[selected].type}</h3><button className="admin-control" disabled={busy} onClick={() => regenerateOne(selected)}>{regenIdx === selected ? "재생성 중…" : "이 장 재생성"}</button></div>
        <fieldset disabled={busy}><legend>Copy / Photo / Crop</legend><SlideEditor slide={slides[selected]} onChange={patch => update(selected,patch)} onBlur={() => save(slides)} onCommit={patch => commit(selected,patch)} /></fieldset>
        <label className="social-field">Category<input value={category} disabled={busy} onChange={event => setCategory(event.target.value)} onBlur={() => save(slides)} /></label>
        <label className="social-field">Caption<textarea value={caption} disabled={busy} rows={7} onChange={event => setCaption(event.target.value)} onBlur={() => save(slides)} /></label><button className="admin-control" onClick={copyCaption}>{copied ? "복사됨" : "Caption 복사"}</button>
        <p className="admin-note">Copy·crop·caption 수정은 기존 save API로 저장합니다. Warning은 실제 API가 반환한 경우에만 표시합니다.</p>
      </section>
    </div>}
  </div>
}
