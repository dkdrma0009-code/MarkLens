"use client"

import { AlertTriangle, CheckCircle2, Clock3, XOctagon } from "lucide-react"
import type { AdminView, EntityView, EventView, HealthView } from "@/lib/brand-watch/admin/view"

export const LAYER = { fact: "FACT", observed: "OBSERVED PATTERN", interpretation: "MARKLENS INTERPRETATION", synthesis: "CURRENT SYNTHESIS" } as const

const KST = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
const KST_DAY = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
export function dateTime(value: string | null | undefined) { return value ? KST.format(new Date(value)) : "—" }
export function day(value: string | null | undefined) { return value ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll("-", ".") : KST_DAY.format(new Date(value))) : "—" }

const statusText: Record<string, string> = {
  draft: "초안 · 검수 필요", published: "게시됨", superseded: "대체됨", withdrawn: "철회·거절",
  pending: "검수 대기", approved: "승인", rejected: "거절", active: "유효",
  needs_review: "검수 필요", reviewed: "검수 완료", no_evidence: "Evidence 없음",
  relevant: "마케팅 관련", uncertain: "관련성 불확실", irrelevant: "관련 없음", unassessed: "미평가",
}
export function StatusLabel({ value, tone }: { value: string; tone?: string }) {
  return <span className={`bw-status bw-status-${tone ?? value}`}>{statusText[value] ?? value}</span>
}

const healthMeta = {
  HEALTHY: { label: "Healthy", note: "계보 정상", icon: CheckCircle2 },
  STALE: { label: "Stale", note: "상위 변경 또는 최신성 만료", icon: Clock3 },
  REVIEW_REQUIRED: { label: "Review required", note: "사람의 재검수 필요", icon: AlertTriangle },
  BROKEN: { label: "Broken", note: "계보 구조 손상", icon: XOctagon },
} as const
const reasonText: Record<string, string> = {
  EVIDENCE_CORRECTED: "연결된 Evidence가 정정(대체·철회)되었습니다", EVIDENCE_REJECTED: "연결된 Evidence가 거절되었습니다",
  UNAPPROVED_EVIDENCE: "게시된 Movement에 미승인 Evidence가 있습니다", UNAPPROVED_ACTOR_ROLE: "주체(primary) 역할 승인이 없습니다",
  NO_EVIDENCE_LINEAGE: "연결된 근거가 없습니다", CROSS_ENTITY_EVIDENCE: "다른 브랜드의 Evidence가 연결되어 있습니다",
  MISSING_MOVEMENT: "연결된 Movement를 찾을 수 없습니다", CROSS_ENTITY_MOVEMENT: "다른 브랜드의 Movement가 연결되어 있습니다",
  INSUFFICIENT_INDEPENDENT_MOVEMENTS: "서로 다른 Movement가 최소 기준보다 적습니다", MOVEMENT_RETIRED: "근거 Movement가 대체·병합·철회되었습니다",
  UPSTREAM_IMPACTED: "상위 근거가 변경되어 최신이 아닙니다", UPSTREAM_BROKEN: "상위 근거 계보가 손상되었습니다",
  FRESHNESS_EXPIRED: "정책상 최신성 기간이 지났습니다", MISSING_PATTERN: "연결된 Pattern을 찾을 수 없습니다",
  CROSS_ENTITY_PATTERN: "다른 브랜드의 Pattern입니다", PATTERN_RETIRED: "근거 Pattern이 대체·철회되었습니다",
  MISSING_EVIDENCE: "연결된 Evidence를 찾을 수 없습니다", EVIDENCE_UNREACHABLE: "Pattern 계보 밖의 Evidence가 연결되어 있습니다",
  NO_TAKE_LINEAGE: "연결된 Take가 없습니다", MISSING_TAKE: "연결된 Take를 찾을 수 없습니다", CROSS_ENTITY_TAKE: "다른 브랜드의 Take입니다",
  TAKE_RETIRED: "근거 Take가 대체·철회되었습니다", COVERAGE_COUNT_MISMATCH: "저장된 근거·출처 수가 계보와 다릅니다",
}
// Meaning is carried by icon + label text, never by color alone. Reasons and causes are expandable.
export function HealthBadge({ health }: { health: HealthView }) {
  if (!health) return <span className="bw-health bw-health-unknown">Health 미계산</span>
  const meta = healthMeta[health.health], Icon = meta.icon
  const badge = <span className={`bw-health bw-health-${health.health.toLowerCase()}`}><Icon size={13} aria-hidden="true" />{meta.label}<span className="sr-only"> — {meta.note}</span></span>
  if (health.health === "HEALTHY") return badge
  return <details className="bw-health-details">
    <summary>{badge}<span className="bw-health-why">왜?</span></summary>
    <ul>{health.reasons.map(reason => <li key={reason}>{reasonText[reason] ?? reason}</li>)}</ul>
    {health.causes.length > 0 && <p>원인 경로: {health.causes.map(cause => <code key={cause}>{cause.replace(/:(.{8}).*$/, ":$1…")}</code>)}</p>}
    <p>{health.action === "REGENERATION_CANDIDATE" ? "재생성 후보입니다. 자동으로 다시 만들지 않습니다." : health.action === "HUMAN_REVIEW" ? "사람의 재검수가 필요합니다." : ""}</p>
  </details>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bw-empty" role="status">{children}</div>
}

const actionText: Record<string, string> = { approve: "승인", reject: "거절", supersede: "대체", merge: "병합", publish: "게시", edit: "수정", split: "분할", unpublish: "게시 취소" }
// Read-only audit trail from brand_watch_review_events.
export function ReviewHistory({ events, targetIds }: { events: readonly EventView[]; targetIds: readonly string[] }) {
  const rows = events.filter(event => targetIds.includes(event.targetId))
  return <section className="bw-history" aria-label="검수 이력">
    <h4>Review history</h4>
    {rows.length === 0 ? <p className="bw-muted">기록된 검수 이력이 없습니다.</p> : <ol>{rows.map(event => <li key={event.id}>
      <div><strong>{actionText[event.action] ?? event.action}</strong><span>{event.targetType}{event.revision ? ` · rev ${event.revision}` : ""}</span><time dateTime={event.occurredAt}>{dateTime(event.occurredAt)}</time></div>
      <p>{event.reason}</p><small>{event.actor}</small>
    </li>)}</ol>}
  </section>
}

export function entityName(view: AdminView, id: string) {
  const entity = view.entities.find(row => row.id === id)
  return entity ? entity.name : "Unknown entity"
}

// Current state of one brand from stored rows only.
export function BrandContext({ view, entity, onSelect }: { view: AdminView; entity: EntityView | undefined; onSelect?: (tab: string, id: string) => void }) {
  if (!entity) return <aside className="bw-context"><p className="bw-eyebrow">BRAND CONTEXT</p><Empty>브랜드를 선택하면 현재 상태가 표시됩니다.</Empty></aside>
  const current = view.snapshots.find(row => row.id === entity.currentSnapshotId)
  const movements = view.movements.filter(row => row.entityId === entity.id && row.status === "published" && !row.mergedIntoId).slice(0, 5)
  const patterns = view.patterns.filter(row => row.entityId === entity.id && row.status === "published").slice(0, 3)
  return <aside className="bw-context" aria-label={`${entity.name} brand context`}>
    <p className="bw-eyebrow">BRAND CONTEXT</p>
    <h3>{entity.name}<small>{entity.nameKo} · {entity.entityType}</small></h3>
    {!entity.inDatabase && <p className="bw-note">DB에 아직 등록되지 않은 launch registry 브랜드입니다.</p>}
    <dl className="bw-meta">
      <div><dt>Current snapshot</dt><dd>{current ? <button type="button" className="bw-link" onClick={() => onSelect?.("analysis:snapshots", current.id)}>{current.headline}</button> : "게시된 Snapshot 없음"}</dd></div>
      <div><dt>Health</dt><dd>{entity.healthSummary ? Object.entries(entity.healthSummary).filter(([, count]) => count > 0).map(([key, count]) => `${key} ${count}`).join(" · ") || "평가할 객체 없음" : view.healthUnavailableEntityIds.includes(entity.id) ? "계산 실패" : "평가할 객체 없음"}</dd></div>
      <div><dt>Last meaningful update</dt><dd>{entity.lastMeaningfulUpdateAt ? dateTime(entity.lastMeaningfulUpdateAt) : "기록 없음"}</dd></div>
    </dl>
    <h4>최근 Movements</h4>
    {movements.length ? <ul className="bw-context-list">{movements.map(row => <li key={row.id}><button type="button" className="bw-link" onClick={() => onSelect?.("movements", row.id)}>{row.title}</button><span>{day(row.occurredOn)}</span></li>)}</ul> : <p className="bw-muted">게시된 Movement가 없습니다.</p>}
    <h4>주요 Patterns</h4>
    {patterns.length ? <ul className="bw-context-list">{patterns.map(row => <li key={row.id}><button type="button" className="bw-link" onClick={() => onSelect?.("analysis:patterns", row.id)}>{row.title}</button><span>{day(row.windowEnd)}</span></li>)}</ul> : <p className="bw-muted">게시된 Pattern이 없습니다.</p>}
  </aside>
}
