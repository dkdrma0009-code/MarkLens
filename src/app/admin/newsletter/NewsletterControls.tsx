"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs } from "@base-ui/react/tabs"
import SocialDialog from "@/components/admin-v2/social/SocialDialog"
import { socialDate } from "@/components/admin-v2/social/types"
import NewsletterPreview from "./NewsletterPreview"

export interface IssueRow { id: string; issue_number: number; title: string; status: string; created_at: string; sent_at?: string | null; open_rate?: number | null; click_rate?: number | null }
type Operation = "generate" | "test" | "send" | "delete"
interface Result { operation: Operation; issueId?: string; title?: string; sentTo?: number; test?: boolean; success?: boolean; errors?: string[]; error?: string }
const subject = (issue: IssueRow) => `[MarkLens] ${issue.title.replace(/^#\d+\s*[—\-–]\s*/, "").trim()}`

export default function NewsletterControls({ issues, subscriberCount, departures, testRecipient }: { issues: IssueRow[]; subscriberCount: number | null; departures: Record<string, number> | null; testRecipient: string | null }) {
  const router = useRouter()
  const lock = useRef(false)
  const focus = useRef<HTMLElement | null>(null)
  const [view, setView] = useState("draft")
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ operation: Operation; issue?: IssueRow } | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const visible = issues.filter(issue => view === "sent" ? issue.status === "sent" : issue.status !== "sent")
  const active = visible.find(issue => issue.id === selected) || visible[0]
  const sendAttempted = !!active && results.some(result => result.operation === "send" && result.issueId === active.id)
  function open(operation: Operation, element: HTMLElement, issue?: IssueRow) { focus.current = element; setAcknowledged(false); setPending({ operation, issue }) }
  async function execute() {
    if (!pending || lock.current) return
    if (pending.operation === "test" && !testRecipient) return
    if (pending.operation === "send" && !acknowledged) return
    lock.current = true; setBusy(true)
    const { operation, issue } = pending
    try {
      const response = await fetch(operation === "generate" ? "/api/newsletter/generate" : operation === "delete" ? `/api/admin/newsletter/${issue!.id}` : "/api/newsletter/send", { method: operation === "delete" ? "DELETE" : "POST", ...(operation === "test" || operation === "send" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueId: issue!.id, ...(operation === "test" ? { testEmail: "me" } : {}) }) } : {}) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `요청 실패 (${response.status})`)
      setResults(previous => [{ operation, issueId: issue?.id, title: issue?.title, ...(operation === "send" || operation === "test" ? { success: data.success, sentTo: data.sentTo, test: data.test, errors: data.errors } : { success: data.success ?? !!data.issue }) }, ...previous])
      setPending(null)
      if (operation !== "test") router.refresh()
    } catch (error) {
      setResults(previous => [{ operation, issueId: issue?.id, title: issue?.title, error: error instanceof Error ? error.message : "요청 실패" }, ...previous])
      setPending(null)
    } finally { lock.current = false; setBusy(false) }
  }
  const description = pending?.operation === "test" ? `테스트 이메일을 실제로 발송합니다. 발송 대상: ${testRecipient || "확인 불가"}. Preview만 여는 작업이 아닙니다. 기존 API의 testEmail: me를 사용하며 issue의 status는 변경하지 않습니다.` : pending?.operation === "send" ? `Subject: ${pending.issue ? subject(pending.issue) : ""}\nRecipient scope: 발송 실행 시점의 status=active 구독자 전체. 현재 조회 ${subscriberCount === null ? "실패 / 인원 확인 불가" : `${subscriberCount}명`}이며 실행 시 달라질 수 있습니다.\n실제 이메일 발송은 철회할 수 없습니다. 부분 실패가 있어도 sent로 기록될 수 있습니다.` : pending?.operation === "delete" ? "뉴스레터 DB row를 삭제합니다. 이미 발송된 이메일을 회수하지 않습니다. 이 화면에서 복구할 수 없습니다." : "기존 생성 API로 새 Draft를 만듭니다. 기존 AI·이미지 생성 처리가 실행되며 실제 이메일은 보내지 않습니다."
  return <div className="ops-workspace"><div className="social-page-heading"><div><p>NEWSLETTER OPERATIONS</p><h2>Weekly publishing operations</h2><span>활성 구독자 {subscriberCount === null ? "조회 실패" : `${subscriberCount}명`} · 최근 최대 20개 호</span></div><button className="admin-control admin-primary" disabled={busy} onClick={event => open("generate", event.currentTarget)}>Generate draft</button></div>
    <Tabs.Root value={view} onValueChange={value => setView(String(value))} className="ops-tabs"><Tabs.List aria-label="Newsletter views"><Tabs.Tab value="draft">Draft / Content</Tabs.Tab><Tabs.Tab value="sent">Sent History</Tabs.Tab></Tabs.List><Tabs.Panel value={view}>
      {!visible.length ? <div className="admin-empty" role="status">{view === "sent" ? "저장된 sent 이력이 없습니다." : "현재 Draft가 없습니다. Generate draft로 새 호를 생성하세요."}</div> : <><nav className="newsletter-issue-list" aria-label="Newsletter 호 선택">{visible.map(issue => <button key={issue.id} aria-pressed={active?.id === issue.id} onClick={() => setSelected(issue.id)}><span>#{issue.issue_number}</span><strong>{issue.title}</strong><small>{issue.status === "sent" ? "Send completed · DB sent" : issue.status}</small></button>)}</nav>{active && <div className="newsletter-layout"><section className="newsletter-details" aria-label="Newsletter details"><p className="ops-eyebrow">{active.status === "sent" ? "SEND COMPLETED / DB RECORD" : "DRAFT / CONTENT"}</p><h3>{active.title}</h3><dl className="ops-metadata"><dt>Subject</dt><dd>{subject(active)}</dd><dt>Issue ID</dt><dd>{active.id}</dd><dt>실제 상태</dt><dd>{active.status}</dd><dt>생성</dt><dd>{socialDate(active.created_at)}</dd><dt>발송 기록</dt><dd>{socialDate(active.sent_at)}</dd>{active.open_rate != null && <><dt>저장된 open_rate</dt><dd>{active.open_rate}</dd></>}{active.click_rate != null && <><dt>저장된 click_rate</dt><dd>{active.click_rate}</dd></>}<dt>발송 후 48시간 구독 취소</dt><dd>{!active.sent_at ? "미발송 — 집계 없음" : departures === null ? "조회 실패" : `${departures[active.id] || 0}명 · 시간상 인접 집계, 인과관계 아님`}</dd></dl>
        <div className="newsletter-actions"><button className="admin-control" disabled={busy || !testRecipient} onClick={event => open("test", event.currentTarget, active)}>실제 테스트 메일</button>{active.status !== "sent" && <button className="admin-control admin-primary" disabled={busy || sendAttempted} onClick={event => open("send", event.currentTarget, active)}>구독자 실제 발송</button>}<button className="admin-control admin-danger" disabled={busy} onClick={event => open("delete", event.currentTarget, active)}>Issue 삭제</button></div><p className="admin-note">Test 수신자: {testRecipient || "확인 불가 — Test 비활성"}</p><p className="admin-note">Preview ≠ 실제 inbox. DB sent ≠ 모든 구독자 전달 성공. 독립 Approval 단계는 없습니다.</p>{sendAttempted && <p className="social-notice">이 화면에서 본발송을 이미 요청했습니다. 중복 메일 위험 때문에 재발송 버튼을 잠급니다. 실제 발송 결과를 먼저 확인하세요.</p>}<p className="admin-note">Test 실행 기록은 아래 이번 화면의 응답에만 남습니다. 과거 Test 이력은 DB가 제공하지 않습니다.</p></section><NewsletterPreview key={active.id} issue={active} /></div>}</>}
    </Tabs.Panel></Tabs.Root>
    {!!results.length && <section className="ops-results" aria-label="Newsletter operation results" aria-live="polite"><p className="ops-eyebrow">THIS SESSION / API RESPONSE</p><h3>작업 결과</h3>{results.map((result, i) => <article key={i}><strong>{result.operation.toUpperCase()} · {result.title || "새 Draft 생성"}</strong>{result.issueId && <p className="admin-note">Issue ID: {result.issueId}</p>}{result.error ? <p role="alert">{result.error}{result.operation === "send" || result.operation === "test" ? " · 응답 오류만으로 실제 발송 여부를 확정할 수 없습니다. 발송 내역 확인 전 다시 보내지 마세요." : ""}</p> : <><p>요청 완료{typeof result.success === "boolean" ? ` · success: ${String(result.success)}` : ""}{typeof result.test === "boolean" ? ` · test: ${String(result.test)}` : ""}</p>{typeof result.sentTo === "number" && <p>Brevo 요청 성공 {result.sentTo} · inbox 전달/열람 보장 아님</p>}{result.errors && <details open><summary>API 오류 {result.errors.length}건</summary>{result.errors.map((error, j) => <p key={j}>{error}</p>)}</details>}</>}</article>)}</section>}
    <SocialDialog label="NEWSLETTER OPERATION" open={!!pending} onClose={() => setPending(null)} title={pending?.operation === "send" ? "구독자에게 실제 이메일을 발송할까요?" : pending?.operation === "test" ? "테스트 이메일을 실제로 보낼까요?" : pending?.operation === "delete" ? "Issue를 삭제할까요?" : "새 Newsletter Draft를 생성할까요?"} description={description} returnFocus={focus} busy={busy}>{pending?.operation === "send" && <label className="ops-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} />실제 발송과 철회 불가를 이해했습니다.</label>}<div className="admin-confirm-buttons"><button className="admin-control" autoFocus disabled={busy} onClick={() => setPending(null)}>취소</button><button className={`admin-control ${pending?.operation === "delete" ? "admin-danger" : "admin-primary"}`} disabled={busy || (pending?.operation === "send" && !acknowledged)} onClick={execute}>{busy ? "요청 처리 중…" : pending?.operation === "test" ? "테스트 이메일 실제 발송" : pending?.operation === "send" ? "구독자 전체 실제 발송" : pending?.operation === "delete" ? "Issue 영구 삭제" : "Draft 생성"}</button></div></SocialDialog>
  </div>
}
