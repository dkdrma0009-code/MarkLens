"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
const CATEGORIES = ["마케팅", "소비자 트렌드", "광고 전략", "디지털 마케팅", "FMCG", "브랜딩", "콘텐츠", "리테일"]
export default function ChallengeForm({ initialDate }: { initialDate: string }) {
  const router = useRouter()
  const lock = useRef(false)
  const [form, setForm] = useState({ title: "", summary: "", category: "마케팅", difficulty: "보통", source_name: "MarkLens", source_url: "", published_date: initialDate, active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  function set(key: keyof typeof form, value: string | boolean) { setForm(previous => ({ ...previous, [key]: value })) }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current || !form.title.trim() || !form.summary.trim()) return
    lock.current = true; setSaving(true); setError(""); setSuccess("")
    try {
      const response = await fetch("/api/admin/insight-lab/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "저장 실패")
      setSuccess(`${form.title} · 등록 완료`); setForm(previous => ({ ...previous, title: "", summary: "", source_url: "" })); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : "저장 실패") }
    finally { lock.current = false; setSaving(false) }
  }
  return <form onSubmit={handleSubmit} className="challenge-form"><fieldset disabled={saving}><label className="social-field">제목 *<input required value={form.title} onChange={event => set("title", event.target.value)} /></label><label className="social-field">요약 (트렌드 내용) *<textarea required rows={5} value={form.summary} onChange={event => set("summary", event.target.value)} /></label><div className="challenge-form-pair"><label className="social-field">카테고리<select value={form.category} onChange={event => set("category", event.target.value)}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label><label className="social-field">난이도<select value={form.difficulty} onChange={event => set("difficulty", event.target.value)}>{["쉬움", "보통", "어려움"].map(value => <option key={value}>{value}</option>)}</select></label></div><div className="challenge-form-pair"><label className="social-field">출처<input value={form.source_name} onChange={event => set("source_name", event.target.value)} /></label><label className="social-field">발행일<input type="date" value={form.published_date} onChange={event => set("published_date", event.target.value)} /></label></div><label className="social-field">출처 URL (선택)<input type="url" value={form.source_url} onChange={event => set("source_url", event.target.value)} /></label><label className="ops-ack"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} />즉시 활성화 · active</label></fieldset><div aria-live="polite">{error && <p role="alert" className="social-notice">{error}</p>}{success && <p role="status" className="challenge-success">{success}</p>}</div><button className="admin-control admin-primary" disabled={saving || !form.title.trim() || !form.summary.trim()}>{saving ? "저장 중…" : "Challenge 등록"}</button></form>
}
