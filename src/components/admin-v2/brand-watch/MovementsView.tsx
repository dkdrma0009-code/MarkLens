"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Search } from "lucide-react"
import type { AdminView, MovementView } from "@/lib/brand-watch/admin/view"
import { byBrand } from "@/lib/brand-watch/admin/filters"
import ReviewAction from "./ReviewAction"
import { BrandContext, Empty, HealthBadge, LAYER, ReviewHistory, StatusLabel, day, entityName } from "./shared"

function MovementActions({ movement, view }: { movement: MovementView; view: AdminView }) {
  const label = (id: string) => { const row = view.movements.find(m => m.id === id); return row ? `${row.title} · ${row.status} · ${day(row.occurredOn)}` : id }
  // Merge targets are same-entity draft/published movements only; related candidates are listed first.
  const targets = [...movement.related.map(row => row.id), ...movement.mergeTargetIds.filter(id => !movement.related.some(row => row.id === id))].map(id => ({ id, label: label(id) }))
  const evidence = view.evidence.filter(row => movement.evidenceIds.includes(row.id))
  const merge = <ReviewAction label="Merge" title="다른 Movement로 병합할까요?" confirmLabel="병합"
    summary={[`원본: ${movement.title}`, "원본은 '대체됨'이 되고 대상 Movement를 가리킵니다. 원본의 Evidence 연결은 삭제되지 않습니다.", "대상이 초안이면 원본의 유효한 Evidence가 대상에 연결되고, 게시된 대상이면 연결은 그대로 두고 계보로 추적합니다."]}
    extra={{ kind: "merge", targets }} build={input => ({ command: "movement.merge", sourceMovementId: movement.id, targetMovementId: input.targetId, reason: input.reason })}
    success={result => result.noop ? "이미 같은 대상으로 병합되어 있습니다" : `병합 완료 · Evidence 연결 ${Number(result.copiedLinks ?? 0)}개 추가`} />
  if (movement.mergedIntoId || movement.status === "superseded" || movement.status === "withdrawn") return <p className="bw-muted">이 Movement는 {movement.status === "withdrawn" ? "철회되었습니다" : "대체·병합되었습니다"}. 기록만 남아 있습니다.</p>
  if (movement.status === "draft") return <div className="bw-actions">
    <ReviewAction label="Approve" tone="primary" title="Movement를 승인(게시)할까요?" confirmLabel="승인" defaultReason="연결된 Evidence와 주체 역할을 확인했습니다."
      summary={["승인하면 FACT 계층의 Movement로 게시됩니다. 연결된 모든 Evidence가 승인되고 primary 역할이 승인되어 있어야 합니다.", `Movement: ${movement.title}`, `Evidence ${movement.evidenceIds.length}건 · 독립 출처 ${movement.independentSourceCount}곳`]}
      build={input => ({ command: "movement.approve", movementId: movement.id, reason: input.reason })} success={() => "Movement 게시 완료"} />
    <ReviewAction label="Reject" tone="danger" title="Movement 초안을 거절할까요?" confirmLabel="거절" summary={["초안은 '철회'로 기록되며 삭제되지 않습니다.", `Movement: ${movement.title}`]}
      build={input => ({ command: "movement.reject", movementId: movement.id, reason: input.reason })} success={() => "Movement 거절 완료"} />
    {merge}
  </div>
  return <div className="bw-actions">
    <ReviewAction label="Supersede" title="게시된 Movement를 정정할까요?" confirmLabel="정정 초안 생성"
      summary={["기존 Movement는 '대체됨'이 되고, 선택한 Evidence로 새 초안이 생성됩니다. 새 초안은 다시 승인해야 게시됩니다.", `현재: ${movement.title}`]}
      extra={{ kind: "movementSupersede", eventKey: movement.eventKey, title: movement.title, summary: movement.summary, importance: movement.importance, evidence: evidence.map(row => ({ id: row.id, label: row.fact.slice(0, 80), usable: row.status === "active" && row.reviewStatus !== "rejected" })) }}
      build={input => ({ command: "movement.supersede", movementId: movement.id, reason: input.reason, successor: { eventKey: input.fields.eventKey.trim(), title: input.fields.title.trim(), summary: input.fields.summary.trim(), movementType: movement.movementType, scope: movement.scope, market: movement.market, channel: movement.channel, startedAt: null, lastObservedAt: movement.lastObservedAt, importance: movement.importance, evidenceIds: input.evidenceIds } })}
      success={() => "정정 초안이 생성되었습니다"} />
    {merge}
  </div>
}

export default function MovementsView({ view, brand, selectedId, onSelect, onNavigate }: { view: AdminView; brand: string; selectedId: string | null; onSelect: (id: string) => void; onNavigate: (tab: string, id: string) => void }) {
  const [status, setStatus] = useState("all"), [query, setQuery] = useState("")
  const list = useMemo(() => byBrand(view.movements, brand).filter(row => (status === "all" || row.status === status) && (!query.trim() || `${row.title} ${row.summary} ${row.eventKey}`.toLowerCase().includes(query.trim().toLowerCase()))), [view, brand, status, query])
  const selected = view.movements.find(row => row.id === selectedId) ?? list[0]
  const evidence = selected ? view.evidence.filter(row => selected.evidenceIds.includes(row.id)) : []
  const sources = selected ? view.sources.filter(row => selected.sourceItemIds.includes(row.id)) : []

  return <div className="bw-workbench">
    <section className="bw-queue" aria-label="Movements">
      <div className="bw-queue-filters">
        <label className="bw-search"><Search size={14} aria-hidden="true" /><span className="sr-only">Movement 검색</span><input type="search" placeholder="제목·요약·event key 검색" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="bw-segmented" role="group" aria-label="상태 필터">{["all", "draft", "published", "superseded", "withdrawn"].map(value => <button type="button" key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "all" ? "전체" : value}</button>)}</div>
        <p className="bw-muted">{list.length}건</p>
      </div>
      {list.length === 0 ? <Empty>표시할 Movement가 없습니다.</Empty> : <ul className="bw-list">{list.map(row => <li key={row.id}>
        <button type="button" aria-pressed={selected?.id === row.id} onClick={() => onSelect(row.id)}>
          <span className="bw-list-meta">{entityName(view, row.entityId)} · {row.movementType} · {day(row.occurredOn)}</span>
          <strong>{row.title}</strong>
          <span className="bw-list-meta">Evidence {row.evidenceIds.length} · 독립 출처 {row.independentSourceCount}</span>
          <span className="bw-list-tags"><StatusLabel value={row.status} /><HealthBadge health={row.health} /></span>
        </button></li>)}</ul>}
    </section>

    <section className="bw-detail" aria-label="Movement detail">
      {!selected ? <Empty>아직 생성된 Movement가 없습니다.</Empty> : <>
        <p className="bw-eyebrow">{LAYER.fact} · MOVEMENT</p>
        <h3 className="bw-detail-title">{selected.title}</h3>
        <div className="bw-detail-badges"><StatusLabel value={selected.status} /><HealthBadge health={selected.health} /></div>
        <p className="bw-body">{selected.summary}</p>
        <dl className="bw-meta bw-meta-grid">
          <div><dt>Entity</dt><dd>{entityName(view, selected.entityId)}</dd></div>
          <div><dt>Type / scope</dt><dd>{selected.movementType} · {selected.scope} · importance {selected.importance}</dd></div>
          <div><dt>Event date</dt><dd>{day(selected.occurredOn)}</dd></div>
          <div><dt>Event key</dt><dd><code>{selected.eventKey.slice(0, 24)}{selected.eventKey.length > 24 ? "…" : ""}</code></dd></div>
          <div><dt>Coverage</dt><dd>Evidence {selected.evidenceIds.length} · 출처 {selected.sourceItemIds.length} · 독립 출처 {selected.independentSourceCount}</dd></div>
          {selected.mergedIntoId && <div><dt>Successor</dt><dd><button type="button" className="bw-link" onClick={() => onSelect(selected.mergedIntoId!)}>{view.movements.find(row => row.id === selected.mergedIntoId)?.title ?? "대상 Movement"}</button></dd></div>}
        </dl>
        <h4 className="bw-section-title">Evidence <span>{evidence.length}</span></h4>
        {evidence.length ? <ul className="bw-rows">{evidence.map(row => <li key={row.id}><p>{row.fact}</p><span><StatusLabel value={row.status === "active" ? row.reviewStatus : row.status} /> · 역할 {row.matchRole ?? "—"} ({row.matchReviewStatus ?? "—"}) · <StatusLabel value={row.relevance} /></span></li>)}</ul> : <Empty>연결된 Evidence가 없습니다.</Empty>}
        <h4 className="bw-section-title">Sources <span>{sources.length}</span></h4>
        {sources.length ? <ul className="bw-rows">{sources.map(row => <li key={row.id}><p>{row.title}</p><span>{row.providerName} · {row.providerType} · <a href={row.originalUrl} target="_blank" rel="noopener noreferrer">원문 <ExternalLink size={11} aria-hidden="true" /></a></span></li>)}</ul> : <Empty>연결된 소스가 없습니다.</Empty>}
        <h4 className="bw-section-title">Clustering · related candidates <span>{selected.related.length}</span></h4>
        {selected.related.length ? <ul className="bw-rows">{selected.related.map(row => <li key={row.id}><p><button type="button" className="bw-link" onClick={() => onSelect(row.id)}>{view.movements.find(m => m.id === row.id)?.title}</button></p><span>제목 유사도 {row.titleSimilarity} · {row.sameType ? "같은 유형" : "다른 유형"} · 날짜 차이 {row.dayDistance === null ? "미상" : `${row.dayDistance}일`}</span></li>)}</ul> : <p className="bw-muted">같은 브랜드에서 같은 사건으로 보이는 후보가 없습니다.</p>}
        <MovementActions movement={selected} view={view} />
        <ReviewHistory events={view.events} targetIds={[selected.id]} />
      </>}
    </section>

    <div className="bw-side"><BrandContext view={view} entity={view.entities.find(entity => entity.id === (selected?.entityId ?? brand))} onSelect={onNavigate} /></div>
  </div>
}
