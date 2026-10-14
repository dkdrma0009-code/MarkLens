"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Search } from "lucide-react"
import type { AdminView, EvidenceView } from "@/lib/brand-watch/admin/view"
import { filterQueue } from "@/lib/brand-watch/admin/filters"
import ReviewAction from "./ReviewAction"
import { BrandContext, Empty, LAYER, ReviewHistory, StatusLabel, dateTime, day, entityName } from "./shared"

const relevanceValue = { relevant: 1, uncertain: 0.5, irrelevant: 0, unassessed: 0.5 } as const

function EvidenceCard({ evidence, view }: { evidence: EvidenceView; view: AdminView }) {
  const pending = evidence.status === "active" && evidence.reviewStatus === "pending", approved = evidence.status === "active" && evidence.reviewStatus === "approved"
  const role = (["primary", "secondary", "mentioned"] as const).find(value => value === evidence.roleCandidate) ?? "primary"
  return <article className="bw-evidence">
    <header><span className="bw-layer">{LAYER.fact} · EVIDENCE</span><StatusLabel value={evidence.status === "active" ? evidence.reviewStatus : evidence.status} /></header>
    <p className="bw-fact">{evidence.fact}</p>
    {evidence.supportText && <blockquote>{evidence.supportText}</blockquote>}
    <dl className="bw-meta bw-meta-grid">
      <div><dt>Entity</dt><dd>{entityName(view, evidence.entityId)}</dd></div>
      <div><dt>Role</dt><dd>{evidence.matchRole ? `${evidence.matchRole} (${evidence.matchReviewStatus})` : "매칭 없음"}{evidence.roleCandidate && evidence.roleCandidate !== evidence.matchRole ? ` · AI 후보 ${evidence.roleCandidate}` : ""}</dd></div>
      <div><dt>Relevance</dt><dd><StatusLabel value={evidence.relevance} /></dd></div>
      <div><dt>Confidence</dt><dd>{evidence.confidence.toFixed(2)} <small>(검증 확률 아님)</small></dd></div>
      <div><dt>Validation</dt><dd>{evidence.validation === "support_validated_candidate" ? "원문 구절 확인됨" : evidence.extractionMethod === "manual" ? "수동 입력" : "기록 없음"}</dd></div>
      <div><dt>Event date</dt><dd>{day(evidence.eventDate)}</dd></div>
      {evidence.correctionReason && <div><dt>Correction</dt><dd>{evidence.correctionReason}</dd></div>}
    </dl>
    <div className="bw-actions">
      {pending && <ReviewAction label="Approve" tone="primary" title="Evidence를 승인할까요?" confirmLabel="승인" defaultReason="원문 근거 구절과 주체를 확인했습니다."
        summary={["승인된 Evidence는 수정할 수 없고, 이후에는 대체(supersede)로만 정정합니다.", `사실: ${evidence.fact}`, "선택한 역할로 이 소스의 브랜드 매칭도 함께 승인됩니다."]}
        extra={{ kind: "role", defaultRole: role }} build={input => ({ command: "evidence.approve", evidenceId: evidence.id, matchRole: input.role, reason: input.reason })} success={() => "Evidence 승인 완료"} />}
      {pending && <ReviewAction label="Reject" tone="danger" title="Evidence를 거절할까요?" confirmLabel="거절" summary={["거절한 Evidence는 Movement에 사용할 수 없습니다. 기록은 삭제되지 않습니다.", `사실: ${evidence.fact}`]}
        build={input => ({ command: "evidence.reject", evidenceId: evidence.id, reason: input.reason })} success={() => "Evidence 거절 완료"} />}
      {approved && <ReviewAction label="Supersede" title="승인된 Evidence를 정정할까요?" confirmLabel="정정본 생성" summary={["기존 Evidence는 '대체됨'으로 남고, 검수 대기 상태의 정정본이 새로 생성됩니다. 이를 사용하는 분석은 Stale로 표시됩니다.", `현재 사실: ${evidence.fact}`]}
        extra={{ kind: "evidenceSupersede", fact: evidence.fact, supportText: evidence.supportText ?? "", eventDate: evidence.eventDate, relevance: relevanceValue[evidence.relevance], confidence: evidence.confidence }}
        build={input => ({ command: "evidence.supersede", evidenceId: evidence.id, reason: input.reason, successor: { sourceItemId: null, fact: input.fields.fact.trim(), supportText: input.fields.supportText.trim(), supportLocator: null, eventDate: input.fields.eventDate || null, datePrecision: input.fields.eventDate ? "day" : "unknown", marketingRelevance: Number(input.fields.relevance), confidence: Number(input.fields.confidence) } })}
        success={() => "정정본이 생성되었습니다 (검수 대기)"} />}
    </div>
  </article>
}

export default function InboxView({ view, brand, selectedId, onSelect, onNavigate }: { view: AdminView; brand: string; selectedId: string | null; onSelect: (id: string) => void; onNavigate: (tab: string, id: string) => void }) {
  const [filters, setFilters] = useState({ review: "needs_review", type: "all", relevance: "all", query: "" })
  const queue = useMemo(() => filterQueue(view.sources, view, { brand, ...filters }), [view, brand, filters])
  const selected = view.sources.find(source => source.id === selectedId) ?? queue[0]
  const evidence = selected ? view.evidence.filter(row => row.sourceItemId === selected.id) : []
  const contextEntity = view.entities.find(entity => entity.id === (selected?.entityIds[0] ?? (brand !== "all" ? brand : "")))
  const linkedMovements = view.movements.filter(movement => evidence.some(row => row.movementIds.includes(movement.id)))
  const types = [...new Set(view.sources.map(source => source.providerType))]

  return <div className="bw-workbench">
    <section className="bw-queue" aria-label="Review queue">
      <div className="bw-queue-filters">
        <label className="bw-search"><Search size={14} aria-hidden="true" /><span className="sr-only">소스 검색</span><input type="search" placeholder="제목·키워드·브랜드 검색" value={filters.query} onChange={event => setFilters(previous => ({ ...previous, query: event.target.value }))} /></label>
        <div className="bw-filter-row">
          <label><span className="sr-only">검수 상태</span><select value={filters.review} onChange={event => setFilters(previous => ({ ...previous, review: event.target.value }))}><option value="all">모든 검수 상태</option><option value="needs_review">검수 필요</option><option value="reviewed">검수 완료</option><option value="no_evidence">Evidence 없음</option></select></label>
          <label><span className="sr-only">소스 유형</span><select value={filters.type} onChange={event => setFilters(previous => ({ ...previous, type: event.target.value }))}><option value="all">모든 소스 유형</option>{types.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          <label><span className="sr-only">관련성</span><select value={filters.relevance} onChange={event => setFilters(previous => ({ ...previous, relevance: event.target.value }))}><option value="all">모든 관련성</option><option value="relevant">마케팅 관련</option><option value="uncertain">불확실</option><option value="irrelevant">관련 없음</option><option value="unassessed">미평가</option></select></label>
        </div>
        <p className="bw-muted">{queue.length}건{view.truncated.sources ? " · 최근 수집 200건 기준" : ""}</p>
      </div>
      {queue.length === 0 ? <Empty>검수할 소스가 없습니다.</Empty> : <ul className="bw-list">{queue.map(source => <li key={source.id}>
        <button type="button" aria-pressed={selected?.id === source.id} onClick={() => onSelect(source.id)}>
          <span className="bw-list-meta">{source.entityIds.map(id => entityName(view, id)).join(" · ") || "브랜드 미매칭"} · {source.providerName}</span>
          <strong>{source.title}</strong>
          <span className="bw-list-meta"><time dateTime={source.collectedAt}>수집 {dateTime(source.collectedAt)}</time>{source.publishedAt && ` · 발행 ${day(source.publishedAt)}`}</span>
          <span className="bw-list-tags"><StatusLabel value={source.reviewState} /><StatusLabel value={source.relevance} /></span>
        </button></li>)}</ul>}
    </section>

    <section className="bw-detail" aria-label="Source detail">
      {!selected ? <Empty>왼쪽 대기열에서 소스를 선택하세요.</Empty> : <>
        <p className="bw-eyebrow">{LAYER.fact} · SOURCE</p>
        <h3 className="bw-detail-title">{selected.title}</h3>
        <p className="bw-detail-sub">{selected.providerName} · {selected.providerType} · <a href={selected.originalUrl} target="_blank" rel="noopener noreferrer">원문 열기 <ExternalLink size={12} aria-hidden="true" /></a></p>
        <dl className="bw-meta bw-meta-grid">
          <div><dt>Published</dt><dd>{selected.publishedAt ? `${day(selected.publishedAt)} (${selected.datePrecision})` : "날짜 미상"}</dd></div>
          <div><dt>Collected</dt><dd>{dateTime(selected.collectedAt)}</dd></div>
          <div><dt>Relevance</dt><dd><StatusLabel value={selected.relevance} /></dd></div>
          <div><dt>Matched entity</dt><dd>{selected.matches.length ? selected.matches.map(match => `${entityName(view, match.entityId)} · ${match.role} (${match.reviewStatus})`).join(", ") : "매칭 없음"}</dd></div>
          <div><dt>Author</dt><dd>{selected.author ?? "—"}</dd></div>
          <div><dt>Source status</dt><dd>{selected.status}</dd></div>
          <div><dt>Content hash</dt><dd><code>{selected.contentHash.slice(0, 12)}…</code></dd></div>
          <div><dt>Rights / retention</dt><dd>{selected.rightsBasis ? `${selected.rightsBasis} · ~${day(selected.retentionUntil)}` : "원문 미보관"}</dd></div>
        </dl>
        <h4 className="bw-section-title">Extracted Evidence Facts <span>{evidence.length}</span></h4>
        {evidence.length ? evidence.map(row => <EvidenceCard key={row.id} evidence={row} view={view} />) : <Empty>이 소스에서 추출된 Evidence가 없습니다.</Empty>}
        <ReviewHistory events={view.events} targetIds={[selected.id, ...evidence.map(row => row.id)]} />
      </>}
    </section>

    <div className="bw-side">
      <BrandContext view={view} entity={contextEntity} onSelect={onNavigate} />
      {selected && <section className="bw-context bw-suggest" aria-label="Linked movements">
        <p className="bw-eyebrow">ANALYSIS LINKS</p>
        {linkedMovements.length ? <ul className="bw-context-list">{linkedMovements.map(movement => <li key={movement.id}><button type="button" className="bw-link" onClick={() => onNavigate("movements", movement.id)}>{movement.title}</button><StatusLabel value={movement.status} /></li>)}</ul>
          : <p className="bw-muted">이 소스의 Evidence는 아직 Movement에 연결되지 않았습니다.</p>}
      </section>}
    </div>
  </div>
}
