"use client"
import { useRef, useState } from "react"
import Image from "next/image"
import { Tabs } from "@base-ui/react/tabs"
interface OverlayForm { masthead: string; tagline: string; headline1: string; headline2: string; highlight: string; handle: string }
interface EndcardForm { img: string; title: string; sub: string }
const OVERLAY_DEFAULT: OverlayForm = { masthead: "MarkLens", tagline: "1 image + 1 prompt = 22s spec ad", headline1: "준비물: 캔 사진 한 장", headline2: "AI로 만든 얼박사 스펙 광고", highlight: "AI", handle: "@marklens.site" }
const ENDCARD_DEFAULT: EndcardForm = { img: "", title: "이 광고, AI로 만들었습니다", sub: "프롬프트 전문은 프로필 링크에서" }
function buildUrl(kind: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ kind })
  for (const [key, value] of Object.entries(params)) if (value.trim()) q.set(key, value.trim())
  return `/api/admin/shorts/preview?${q.toString()}`
}
export default function AdKitStudio() {
  const [kind, setKind] = useState("overlay")
  const [overlay, setOverlay] = useState(OVERLAY_DEFAULT)
  const [endcard, setEndcard] = useState(ENDCARD_DEFAULT)
  const [appliedOverlay, setAppliedOverlay] = useState(OVERLAY_DEFAULT)
  const [appliedEndcard, setAppliedEndcard] = useState(ENDCARD_DEFAULT)
  const [version, setVersion] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [uploaded, setUploaded] = useState(false)
  const uploadLock = useRef(false)
  async function uploadImage(file: File) {
    if (uploadLock.current) return
    setUploadError(""); setUploaded(false)
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setUploadError("jpeg/png/webp만 가능합니다."); return }
    if (file.size > 5 * 1024 * 1024) { setUploadError("5MB 이하만 가능합니다."); return }
    uploadLock.current = true; setUploading(true)
    try {
      const body = new FormData(); body.append("file", file)
      const response = await fetch("/api/admin/adkit/upload", { method: "POST", body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "업로드 실패")
      setEndcard(previous => ({ ...previous, img: data.url })); setAppliedEndcard(previous => ({ ...previous, img: data.url })); setVersion(value => value + 1); setUploaded(true)
    } catch (error) { setUploadError(error instanceof Error ? error.message : "업로드 실패") }
    finally { uploadLock.current = false; setUploading(false) }
  }
  function apply() { setAppliedOverlay(overlay); setAppliedEndcard(endcard); setVersion(value => value + 1) }
  const overlayUrl = buildUrl("ad-overlay", { ...appliedOverlay, v: String(version) })
  const endcardUrl = buildUrl("ad-endcard", { ...appliedEndcard, v: String(version) })
  const url = kind === "overlay" ? overlayUrl : endcardUrl
  const changed = kind === "overlay" ? JSON.stringify(overlay) !== JSON.stringify(appliedOverlay) : JSON.stringify(endcard) !== JSON.stringify(appliedEndcard)
  return <Tabs.Root value={kind} onValueChange={value => setKind(String(value))} className="ops-tabs"><Tabs.List aria-label="AdKit asset type"><Tabs.Tab value="overlay">Overlay</Tabs.Tab><Tabs.Tab value="endcard">Endcard</Tabs.Tab></Tabs.List><Tabs.Panel value={kind}><div className="adkit-layout"><AssetPreview key={url} url={url} kind={kind} /><section className="adkit-settings" aria-label="Asset settings"><p className="ops-eyebrow">{kind === "overlay" ? "OVERLAY / TRANSPARENT PNG" : "ENDCARD / FULL FRAME PNG"}</p><h3>{kind === "overlay" ? "영상 위 브랜드 레이어" : "마지막 2–3초 브랜드 마감"}</h3><fieldset disabled={uploading}><legend className="sr-only">AdKit settings</legend>{kind === "overlay" ? <>{([["masthead", "마스트헤드"], ["tagline", "태그라인 · 영문 권장"], ["headline1", "헤드라인 1줄"], ["headline2", "헤드라인 2줄"], ["highlight", "강조 단어"], ["handle", "핸들"]] as const).map(([key, label]) => <label className="social-field" key={key}>{label}<input value={overlay[key]} onChange={event => setOverlay(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}</> : <><label className="social-field">제품 이미지 업로드 · JPEG / PNG / WebP, 최대 5MB<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) uploadImage(file); event.target.value = "" }} /></label><label className="social-field">제품 이미지 URL · 비우면 텍스트만<input value={endcard.img} placeholder="https://…" onChange={event => setEndcard(previous => ({ ...previous, img: event.target.value }))} /></label><label className="social-field">타이틀<input value={endcard.title} onChange={event => setEndcard(previous => ({ ...previous, title: event.target.value }))} /></label><label className="social-field">서브 카피<input value={endcard.sub} onChange={event => setEndcard(previous => ({ ...previous, sub: event.target.value }))} /></label></>}</fieldset>
    <div aria-live="polite">{uploading && <p role="status">제품 이미지를 업로드하는 중…</p>}{uploadError && <p className="social-notice" role="alert">{uploadError} · 다른 파일을 선택해 다시 시도할 수 있습니다.</p>}{uploaded && <p className="admin-note">업로드 응답 수신 · 새 URL을 Endcard Preview에 적용했습니다. 기존 Storage 파일은 삭제하지 않습니다.</p>}</div><button className="admin-control admin-primary" disabled={uploading} onClick={apply}>설정 적용 / Preview 갱신</button><p className="admin-note" role="status">{changed ? "아직 Preview에 반영하지 않은 변경이 있습니다. PNG 다운로드는 현재 Preview 설정을 사용합니다." : "Preview와 PNG 다운로드는 동일한 renderer URL·적용 설정을 사용합니다."}</p><p className="admin-note">업로드는 기존 ad-assets Storage에 새 파일을 생성합니다. URL 입력은 설정 적용 후 반영됩니다.</p>
    <details className="adkit-instructions"><summary>CapCut 조립 순서</summary><ol><li>영상 트랙에 Veo 클립 배치</li><li>Overlay PNG를 전체 길이 레이어로 사용 · 중앙 투명</li><li>마지막 2–3초에 Endcard PNG 배치</li><li>음악 적용 후 1080 × 1920으로 내보내기</li></ol></details></section></div></Tabs.Panel></Tabs.Root>
}
function AssetPreview({ url, kind }: { url: string; kind: string }) {
  const [status, setStatus] = useState("loading")
  const [retry, setRetry] = useState(0)
  const source = retry ? `${url}&retry=${retry}` : url
  return <section className="adkit-preview" aria-label={`${kind} actual PNG preview`}><div className="ops-panel-heading"><div><p>ASSET / ACTUAL OUTPUT</p><h3>{kind === "overlay" ? "Overlay" : "Endcard"}</h3></div>{status === "ready" && <a className="admin-control" href={source} download={`marklens-ad-${kind}.png`}>PNG 다운로드</a>}</div><div className={`adkit-canvas ${kind === "overlay" ? "is-transparent" : ""}`}><Image key={source} src={source} alt={`${kind} 실제 PNG output`} width={1080} height={1920} unoptimized onLoad={() => setStatus("ready")} onError={() => setStatus("error")} /></div><div aria-live="polite">{status === "loading" && <p role="status">기존 PNG renderer의 결과를 불러오는 중…</p>}{status === "error" && <div className="social-notice" role="alert"><p>PNG output을 불러오지 못했습니다. 입력 값과 이미지 URL을 확인하세요.</p><button className="admin-control" onClick={() => { setStatus("loading"); setRetry(value => value + 1) }}>Render 다시 시도</button></div>}</div><p className="admin-note">1080 × 1920 · {kind === "overlay" ? "체커보드는 투명도 검수 배경이며 PNG에 포함되지 않습니다." : "기존 제품 이미지·텍스트 renderer입니다."}</p></section>
}
