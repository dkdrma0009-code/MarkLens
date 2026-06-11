"use client"

import { useState } from "react"
import { Download, RefreshCw } from "lucide-react"

interface OverlayForm {
  masthead: string
  tagline: string
  headline1: string
  headline2: string
  highlight: string
  handle: string
}

interface EndcardForm {
  img: string
  title: string
  sub: string
}

const OVERLAY_DEFAULT: OverlayForm = {
  masthead: "MarkLens",
  tagline: "1 image + 1 prompt = 22s spec ad",
  headline1: "준비물: 캔 사진 한 장",
  headline2: "AI로 만든 얼박사 스펙 광고",
  highlight: "AI",
  handle: "@marklens.site",
}

const ENDCARD_DEFAULT: EndcardForm = {
  img: "",
  title: "이 광고, AI로 만들었습니다",
  sub: "프롬프트 전문은 프로필 링크에서",
}

function buildUrl(kind: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ kind })
  for (const [k, v] of Object.entries(params)) {
    if (v.trim()) q.set(k, v.trim())
  }
  return `/api/admin/shorts/preview?${q.toString()}`
}

export default function AdKitStudio() {
  const [overlay, setOverlay] = useState<OverlayForm>(OVERLAY_DEFAULT)
  const [endcard, setEndcard] = useState<EndcardForm>(ENDCARD_DEFAULT)
  // 적용된 파라미터 (미리보기 갱신 버튼으로 반영 — 타이핑마다 렌더 호출 방지)
  const [appliedOverlay, setAppliedOverlay] = useState<OverlayForm>(OVERLAY_DEFAULT)
  const [appliedEndcard, setAppliedEndcard] = useState<EndcardForm>(ENDCARD_DEFAULT)
  const [v, setV] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  async function uploadImage(file: File) {
    setUploading(true)
    setUploadError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/adkit/upload", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "업로드 실패")
      setEndcard(e => ({ ...e, img: json.url }))
      // 업로드 직후 미리보기에 바로 반영
      setAppliedEndcard(e => ({ ...e, img: json.url }))
      setV(x => x + 1)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "업로드 실패")
    } finally {
      setUploading(false)
    }
  }

  function apply() {
    setAppliedOverlay(overlay)
    setAppliedEndcard(endcard)
    setV(x => x + 1)
  }

  const overlayUrl = buildUrl("ad-overlay", { ...appliedOverlay, v: String(v) })
  const endcardUrl = buildUrl("ad-endcard", { ...appliedEndcard, v: String(v) })

  const input = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-foreground/40 transition-colors"
  const label = "text-xs font-medium text-muted-foreground"

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-8 items-start">
      {/* ── 입력 폼 ── */}
      <div className="space-y-6">
        <div className="border border-border rounded-xl p-4 space-y-3 bg-background">
          <p className="text-sm font-bold">오버레이 (영상 위 레이어)</p>
          <div className="space-y-2">
            <label className={label}>마스트헤드</label>
            <input className={input} value={overlay.masthead} onChange={e => setOverlay({ ...overlay, masthead: e.target.value })} />
            <label className={label}>태그라인 (이탤릭 세리프, 영문 권장)</label>
            <input className={input} value={overlay.tagline} onChange={e => setOverlay({ ...overlay, tagline: e.target.value })} />
            <label className={label}>헤드라인 1줄</label>
            <input className={input} value={overlay.headline1} onChange={e => setOverlay({ ...overlay, headline1: e.target.value })} />
            <label className={label}>헤드라인 2줄</label>
            <input className={input} value={overlay.headline2} onChange={e => setOverlay({ ...overlay, headline2: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>강조 단어</label>
                <input className={input} value={overlay.highlight} onChange={e => setOverlay({ ...overlay, highlight: e.target.value })} />
              </div>
              <div>
                <label className={label}>핸들</label>
                <input className={input} value={overlay.handle} onChange={e => setOverlay({ ...overlay, handle: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border rounded-xl p-4 space-y-3 bg-background">
          <p className="text-sm font-bold">엔드카드 (마지막 2~3초)</p>
          <div className="space-y-2">
            <label className={label}>제품 이미지 (파일 업로드 또는 URL — 비우면 텍스트만)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
              className="w-full text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-background file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/50 file:transition-colors file:cursor-pointer"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />
            {uploading && <p className="text-xs text-muted-foreground">업로드 중…</p>}
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
            <input className={input} placeholder="https://..." value={endcard.img} onChange={e => setEndcard({ ...endcard, img: e.target.value })} />
            <label className={label}>타이틀</label>
            <input className={input} value={endcard.title} onChange={e => setEndcard({ ...endcard, title: e.target.value })} />
            <label className={label}>서브 카피</label>
            <input className={input} value={endcard.sub} onChange={e => setEndcard({ ...endcard, sub: e.target.value })} />
          </div>
        </div>

        <button onClick={apply}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity">
          <RefreshCw className="w-4 h-4" /> 미리보기 갱신
        </button>

        <div className="rounded-xl bg-muted/30 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground mb-1.5">CapCut 조립 순서</p>
          1. 영상 트랙에 Veo 클립 배치<br />
          2. 오버레이 PNG를 전체 길이 레이어로 (중앙 투명)<br />
          3. 마지막 2~3초에 엔드카드 PNG<br />
          4. 음악 → 1080×1920 내보내기
        </div>
      </div>

      {/* ── 미리보기 + 다운로드 ── */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold">오버레이</p>
            <a href={overlayUrl} download="marklens-ad-overlay.png"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border font-medium hover:bg-muted/50 transition-colors">
              <Download className="w-3.5 h-3.5" /> PNG
            </a>
          </div>
          {/* 투명 영역 확인용 체커보드 배경 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={overlayUrl} alt="overlay preview"
            className="w-full aspect-[9/16] object-contain rounded-xl border border-border"
            style={{ background: "repeating-conic-gradient(#e5e5e5 0% 25%, #fafafa 0% 50%) 50% / 24px 24px" }} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold">엔드카드</p>
            <a href={endcardUrl} download="marklens-ad-endcard.png"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border font-medium hover:bg-muted/50 transition-colors">
              <Download className="w-3.5 h-3.5" /> PNG
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={endcardUrl} alt="endcard preview"
            className="w-full aspect-[9/16] object-contain rounded-xl border border-border bg-black" />
        </div>
      </div>
    </div>
  )
}
