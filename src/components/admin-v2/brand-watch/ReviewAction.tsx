"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
import SocialDialog from "@/components/admin-v2/social/SocialDialog"
import { reviewMessage } from "@/lib/brand-watch/admin/messages"

export type ActionExtra =
  | { kind: "role"; defaultRole: "primary" | "secondary" | "mentioned" }
  | { kind: "merge"; targets: { id: string; label: string }[] }
  | { kind: "evidenceSupersede"; fact: string; supportText: string; eventDate: string | null; relevance: number; confidence: number }
  | { kind: "movementSupersede"; eventKey: string; title: string; summary: string; importance: number; evidence: { id: string; label: string; usable: boolean }[] }

export interface ActionInput { reason: string; role: string; targetId: string; fields: Record<string, string>; evidenceIds: string[] }
type Result = Record<string, unknown>

// One confirmed review command. Mutations only go through the admin route → existing Brand Watch RPCs.
export default function ReviewAction({ label, tone = "default", title, summary, confirmLabel, defaultReason = "", extra, build, success }: {
  label: string; tone?: "primary" | "danger" | "default"; title: string; summary: string[]; confirmLabel: string; defaultReason?: string
  extra?: ActionExtra; build: (input: ActionInput) => Record<string, unknown>; success: (result: Result) => string
}) {
  const router = useRouter(), lock = useRef(false), focus = useRef<HTMLElement | null>(null)
  const initialFields = (): Record<string, string> => extra?.kind === "evidenceSupersede" ? { fact: extra.fact, supportText: extra.supportText, eventDate: extra.eventDate ?? "", relevance: String(extra.relevance), confidence: String(extra.confidence) }
    : extra?.kind === "movementSupersede" ? { eventKey: `${extra.eventKey}-r`, title: extra.title, summary: extra.summary, importance: String(extra.importance) } : {}
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("")
  const [reason, setReason] = useState(defaultReason), [role, setRole] = useState(extra?.kind === "role" ? extra.defaultRole : "primary")
  const [targetId, setTargetId] = useState(""), [fields, setFields] = useState<Record<string, string>>(initialFields)
  const [evidenceIds, setEvidenceIds] = useState<string[]>(extra?.kind === "movementSupersede" ? extra.evidence.filter(row => row.usable).map(row => row.id) : [])
  const ready = reason.trim().length > 0 && (extra?.kind !== "merge" || targetId !== "") && (extra?.kind !== "movementSupersede" || evidenceIds.length > 0)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current || !ready) return
    lock.current = true; setBusy(true); setError("")
    try {
      const response = await fetch("/api/admin/brand-watch/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: build({ reason: reason.trim(), role, targetId, fields, evidenceIds }) }) })
      const data = await response.json().catch(() => ({ ok: false, code: "DATABASE_ERROR" }))
      if (!data.ok) { setError(reviewMessage(String(data.code))); return }
      setDone(success(data.result ?? {})); setOpen(false); router.refresh()
    } catch { setError(reviewMessage("NETWORK_ERROR")) }
    finally { lock.current = false; setBusy(false) }
  }
  const field = (key: string, text: string, type: "text" | "textarea" | "date" | "number" = "text") => <label className="social-field" key={key}>{text}
    {type === "textarea" ? <textarea rows={3} required value={fields[key] ?? ""} onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} />
      : <input type={type} required={type !== "date"} step={type === "number" ? "0.05" : undefined} min={type === "number" ? 0 : undefined} max={type === "number" ? 1 : undefined} value={fields[key] ?? ""} onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} />}
  </label>

  return <>
    <button type="button" className={`admin-control ${tone === "primary" ? "admin-primary" : tone === "danger" ? "bw-danger-outline" : ""}`} onClick={event => { focus.current = event.currentTarget; setError(""); setDone(""); setOpen(true) }}>{label}</button>
    {done && <span className="bw-action-result" role="status">{done}</span>}
    <SocialDialog label="BRAND WATCH REVIEW" open={open} onClose={() => setOpen(false)} title={title} description={summary[0] ?? ""} busy={busy} returnFocus={focus}>
      <form onSubmit={submit} className="bw-action-form">
        {summary.length > 1 && <ul className="bw-action-summary">{summary.slice(1).map(line => <li key={line}>{line}</li>)}</ul>}
        <fieldset disabled={busy}>
          {extra?.kind === "role" && <label className="social-field">승인할 주체 역할
            <select value={role} onChange={event => setRole(event.target.value as typeof role)}>
              <option value="primary">primary — 브랜드가 직접 수행</option><option value="secondary">secondary — 공동 참여</option><option value="mentioned">mentioned — 언급만</option>
            </select></label>}
          {extra?.kind === "merge" && (extra.targets.length ? <label className="social-field">병합 대상 (같은 브랜드)
            <select required value={targetId} onChange={event => setTargetId(event.target.value)}>
              <option value="">대상 Movement 선택</option>{extra.targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}
            </select></label> : <p className="bw-note">같은 브랜드에 병합할 수 있는 Movement가 없습니다.</p>)}
          {extra?.kind === "evidenceSupersede" && <>{field("fact", "정정된 사실", "textarea")}{field("supportText", "원문 근거 구절", "textarea")}{field("eventDate", "이벤트 날짜 (선택)", "date")}
            <label className="social-field">마케팅 관련성<select value={fields.relevance} onChange={event => setFields(previous => ({ ...previous, relevance: event.target.value }))}><option value="1">관련</option><option value="0.5">불확실</option><option value="0">관련 없음</option></select></label>
            {field("confidence", "검수자 신뢰도 (0–1)", "number")}</>}
          {extra?.kind === "movementSupersede" && <>{field("eventKey", "새 event key")}{field("title", "제목")}{field("summary", "요약", "textarea")}
            <fieldset className="bw-checklist"><legend>새 Movement에 연결할 Evidence</legend>{extra.evidence.map(row => <label key={row.id}><input type="checkbox" disabled={!row.usable} checked={evidenceIds.includes(row.id)} onChange={event => setEvidenceIds(previous => event.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id))} /> {row.label}{!row.usable && " (사용 불가)"}</label>)}</fieldset></>}
          <label className="social-field">검수 사유 (필수)<textarea rows={3} required value={reason} onChange={event => setReason(event.target.value)} placeholder="판단 근거를 기록합니다. 감사 이력에 남습니다." /></label>
        </fieldset>
        {error && <p role="alert" className="admin-data-error">{error}</p>}
        <div className="admin-confirm-buttons">
          <button type="button" className="admin-control" disabled={busy} onClick={() => setOpen(false)}>취소</button>
          <button className={`admin-control ${tone === "danger" ? "admin-danger" : "admin-primary"}`} disabled={busy || !ready}>{busy ? <><LoaderCircle size={15} className="admin-spin" aria-hidden="true" /> 처리 중…</> : confirmLabel}</button>
        </div>
      </form>
    </SocialDialog>
  </>
}
