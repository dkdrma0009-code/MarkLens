"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import SocialDialog from "@/components/admin-v2/social/SocialDialog"

export function ToggleSource({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const router = useRouter()
  const lock = useRef(false)
  const focus = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState("")
  async function toggle() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setResult("")
    try {
      const response = await fetch("/api/admin/sources", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active: !isActive }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "상태 변경 실패")
      setResult(isActive ? "비활성화 요청 완료" : "활성화 요청 완료"); setOpen(false); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : "상태 변경 실패") }
    finally { lock.current = false; setBusy(false) }
  }
  return <><button className="admin-control" disabled={busy} aria-label={`${name} · ${isActive ? "활성 — 비활성화" : "비활성 — 활성화"}`} onClick={event => { focus.current = event.currentTarget; setError(""); setOpen(true) }}>{isActive ? "활성" : "비활성"}</button><span className="source-operation-result" aria-live="polite">{result}</span><SocialDialog label="INGESTION OPERATION" open={open} onClose={() => setOpen(false)} title={`${name} 소스를 ${isActive ? "비활성화" : "활성화"}할까요?`} description={isActive ? "이 소스는 이후 자동 RSS 수집 대상에서 제외됩니다. 기존 기사와 Insight는 삭제하지 않습니다." : "이 소스를 이후 자동 RSS 수집 대상에 포함합니다. 지금 즉시 수집을 실행하지는 않습니다."} busy={busy} returnFocus={focus}>{error && <p role="alert" className="admin-data-error">{error}</p>}<div className="admin-confirm-buttons"><button className="admin-control" disabled={busy} onClick={() => setOpen(false)}>취소</button><button className="admin-control admin-primary" disabled={busy} onClick={toggle}>{busy ? "변경 중…" : "수집 상태 변경"}</button></div></SocialDialog></>
}
export function AddSourceForm() {
  const router = useRouter()
  const lock = useRef(false)
  const focus = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState("")
  const [form, setForm] = useState({ name: "", slug: "", rss_url: "", website_url: "" })
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setResult("")
    try {
      const response = await fetch("/api/admin/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "소스 추가 실패")
      setResult("활성 RSS 소스 추가 완료"); setForm({ name: "", slug: "", rss_url: "", website_url: "" }); setOpen(false); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : "소스 추가 실패") }
    finally { lock.current = false; setBusy(false) }
  }
  return <div><button className="admin-control admin-primary" onClick={event => { focus.current = event.currentTarget; setError(""); setOpen(true) }}>New source</button><p className="admin-note" role="status">{result}</p><SocialDialog label="INGESTION OPERATION" open={open} onClose={() => setOpen(false)} title="RSS 소스 추가" description="기존 API는 새 소스를 활성 상태로 등록합니다. 다음 자동 RSS 수집 대상에 포함됩니다. 필수값/중복 등 API 오류를 표시합니다. 이 API는 RSS 피드의 실제 유효성을 검사하지 않습니다." returnFocus={focus} busy={busy}><form onSubmit={submit}><fieldset disabled={busy}>{([["name", "소스명"], ["slug", "슬러그"], ["rss_url", "RSS URL"], ["website_url", "웹사이트 URL"]] as const).map(([key, label]) => <label className="social-field" key={key}>{label}<input required type={key.endsWith("url") ? "url" : "text"} value={form[key]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}</fieldset>{error && <p role="alert" className="admin-data-error">{error}</p>}<div className="admin-confirm-buttons"><button type="button" className="admin-control" disabled={busy} onClick={() => setOpen(false)}>취소</button><button className="admin-control admin-primary" disabled={busy}>{busy ? "추가 중…" : "활성 소스 등록"}</button></div></form></SocialDialog></div>
}
