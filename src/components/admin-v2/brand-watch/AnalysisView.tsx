"use client"

import { useMemo, useState } from "react"
import type { AdminView, PatternView, SnapshotView, TakeView } from "@/lib/brand-watch/admin/view"
import { byBrand } from "@/lib/brand-watch/admin/filters"
import type { AnalysisKind } from "@/lib/brand-watch/admin/constants"
import ReviewAction from "./ReviewAction"
import { BrandContext, Empty, HealthBadge, LAYER, ReviewHistory, StatusLabel, dateTime, day, entityName } from "./shared"

const STATUSES = ["all", "draft", "published", "superseded", "withdrawn"]

function Uncertainties({ items }: { items: readonly string[] }) {
  return <><h4 className="bw-section-title">Uncertainties <span>{items.length}</span></h4>
    {items.length ? <ul className="bw-uncertain">{items.map(item => <li key={item}>{item}</li>)}</ul> : <p className="bw-muted">기록된 불확실성이 없습니다.</p>}</>
}
function Revision({ revision, supersedesId, title }: { revision: number; supersedesId: string | null; title?: string }) {
  return <span className="bw-revision">rev {revision}{supersedesId ? ` · 이전 버전 대체${title ? `: ${title}` : ""}` : ""}</span>
}
function publishActions(kind: "pattern" | "take" | "snapshot", row: { id: string; status: string; supersedesId: string | null }, name: string, extraSummary: string[], view: AdminView) {
  if (row.status !== "draft") return null
  const previous = row.supersedesId ? "이전 게시 버전은 '대체됨'으로 남고 새 버전이 게시됩니다." : "새 게시 버전이 됩니다."
  const label = { pattern: "Pattern", take: "Take", snapshot: "Snapshot" }[kind]
  return <div className="bw-actions">
    <ReviewAction label="Publish" tone="primary" title={`${label}를 게시할까요?`} confirmLabel="게시" defaultReason="계보와 표현을 검수했습니다."
      summary={[`${name}`, previous, ...extraSummary]}
      build={input => ({ command: `${kind}.publish`, [`${kind}Id`]: row.id, reason: input.reason })}
      success={result => kind === "snapshot" ? (result.previousCurrentSnapshotId ? `게시 완료 · current Snapshot이 이전 버전(${String(result.previousCurrentSnapshotId).slice(0, 8)}…)에서 이 Snapshot으로 전환되었습니다` : "게시 완료 · 이 브랜드의 첫 current Snapshot으로 지정되었습니다") : `${label} 게시 완료`} />
    <ReviewAction label="Reject" tone="danger" title={`${label} 초안을 거절할까요?`} confirmLabel="거절" summary={[`${name}`, "초안은 '철회'로 기록되며 삭제되지 않습니다. 자동으로 다시 생성하지 않습니다."]}
      build={input => ({ command: `${kind}.reject`, [`${kind}Id`]: row.id, reason: input.reason })} success={() => `${label} 거절 완료`} />
    {kind === "snapshot" && view.snapshots.some(other => other.entityId === (row as SnapshotView).entityId && other.isCurrent) && !row.supersedesId && <p className="bw-note">이미 current Snapshot이 있으므로 이 초안은 revision이 아니면 게시가 거절됩니다.</p>}
  </div>
}

function PatternDetail({ row, view, onNavigate }: { row: PatternView; view: AdminView; onNavigate: (tab: string, id: string) => void }) {
  const previous = view.patterns.find(p => p.id === row.supersedesId)
  return <>
    <p className="bw-eyebrow">{LAYER.observed}</p>
    <h3 className="bw-detail-title">{row.title}</h3>
    <div className="bw-detail-badges"><StatusLabel value={row.status} /><HealthBadge health={row.health} /><Revision revision={row.revision} supersedesId={row.supersedesId} /></div>
    <p className="bw-body">{row.description}</p>
    <dl className="bw-meta bw-meta-grid">
      <div><dt>Entity</dt><dd>{entityName(view, row.entityId)}</dd></div>
      <div><dt>Window</dt><dd>{day(row.windowStart)} – {day(row.windowEnd)}</dd></div>
      <div><dt>Independent movements</dt><dd>{row.independentMovementCount}</dd></div>
      <div><dt>Independent sources</dt><dd>{row.independentSourceCount}</dd></div>
      <div><dt>Confidence</dt><dd>{row.confidence.toFixed(2)} <small>(분류 신호, 확률 아님)</small></dd></div>
      <div><dt>Provenance</dt><dd>{row.model ?? "manual"} · {row.promptVersion ?? "—"}</dd></div>
    </dl>
    <Uncertainties items={row.uncertainties} />
    <h4 className="bw-section-title">Supporting movements <span>{row.movementIds.length}</span></h4>
    <ul className="bw-rows">{row.movementIds.map(id => { const movement = view.movements.find(m => m.id === id); return <li key={id}><p>{movement ? <button type="button" className="bw-link" onClick={() => onNavigate("movements", id)}>{movement.title}</button> : "불러오지 못한 Movement"}</p>{movement && <span><StatusLabel value={movement.status} /> · {day(movement.occurredOn)} · <HealthBadge health={movement.health} /></span>}</li> })}</ul>
    {previous && <div className="bw-compare"><p className="bw-eyebrow">PREVIOUS VERSION · rev {previous.revision} · {previous.status}</p><strong>{previous.title}</strong><p>{previous.description}</p><small>Movement {previous.movementIds.length}개 → 이번 버전 {row.movementIds.length}개</small></div>}
    {publishActions("pattern", row, `Pattern: ${row.title}`, [`독립 Movement ${row.independentMovementCount}개 · 독립 출처 ${row.independentSourceCount}곳`], view)}
    <ReviewHistory events={view.events} targetIds={[row.id, ...(previous ? [previous.id] : [])]} />
  </>
}

function TakeDetail({ row, view, onNavigate }: { row: TakeView; view: AdminView; onNavigate: (tab: string, id: string) => void }) {
  const pattern = view.patterns.find(p => p.id === row.patternId), previous = view.takes.find(t => t.id === row.supersedesId)
  const evidence = view.evidence.filter(e => row.evidenceIds.includes(e.id))
  return <>
    <p className="bw-eyebrow">{LAYER.interpretation}</p>
    <div className="bw-interpretation-banner" role="note">이 내용은 사실(FACT)이 아니라 MarkLens의 해석입니다. 근거 Evidence는 아래에 따로 표시됩니다.</div>
    <div className="bw-detail-badges"><StatusLabel value={row.status} /><HealthBadge health={row.health} /><Revision revision={row.revision} supersedesId={row.supersedesId} /></div>
    <div className="bw-take">
      <section><h4>WHAT WE SEE</h4><p>{row.whatWeSee}</p></section>
      <section><h4>WHY IT MAY MATTER</h4><p>{row.whyItMayMatter}</p></section>
      <section><h4>WHAT TO WATCH NEXT</h4><p>{row.whatToWatchNext}</p></section>
    </div>
    <dl className="bw-meta bw-meta-grid">
      <div><dt>Pattern</dt><dd>{pattern ? <button type="button" className="bw-link" onClick={() => onNavigate("analysis:patterns", pattern.id)}>{pattern.title}</button> : "불러오지 못함"}</dd></div>
      <div><dt>Confidence</dt><dd>{row.confidence === null ? "기록 없음" : `${row.confidence.toFixed(2)}`} <small>(확률 아님)</small></dd></div>
      <div><dt>Provenance</dt><dd>{row.model ?? "manual"}</dd></div>
      <div><dt>Created</dt><dd>{dateTime(row.createdAt)}</dd></div>
    </dl>
    <Uncertainties items={row.uncertainties} />
    <h4 className="bw-section-title">Supporting evidence · {LAYER.fact} <span>{evidence.length}</span></h4>
    <ul className="bw-rows">{evidence.map(e => <li key={e.id}><p>{e.fact}</p><span><StatusLabel value={e.status === "active" ? e.reviewStatus : e.status} /></span></li>)}</ul>
    {previous && <div className="bw-compare"><p className="bw-eyebrow">PREVIOUS VERSION · rev {previous.revision} · {previous.status}</p><p>{previous.whyItMayMatter}</p></div>}
    {publishActions("take", row, `Take (Pattern: ${pattern?.title ?? "—"})`, ["게시된 Take는 해석으로 표시되며 사실로 표기되지 않습니다."], view)}
    <ReviewHistory events={view.events} targetIds={[row.id, ...(previous ? [previous.id] : [])]} />
  </>
}

function SnapshotDetail({ row, view, onNavigate }: { row: SnapshotView; view: AdminView; onNavigate: (tab: string, id: string) => void }) {
  const takes = view.takes.filter(t => row.takeIds.includes(t.id)), patterns = view.patterns.filter(p => row.patternIds.includes(p.id)), movements = view.movements.filter(m => row.movementIds.includes(m.id))
  const current = view.snapshots.find(s => s.entityId === row.entityId && s.isCurrent)
  return <>
    <p className="bw-eyebrow">{LAYER.synthesis}</p>
    <h3 className="bw-detail-title">{row.headline}</h3>
    <div className="bw-detail-badges"><StatusLabel value={row.status} />{row.isCurrent && <span className="bw-current">CURRENT</span>}<HealthBadge health={row.health} /><Revision revision={row.revision} supersedesId={row.supersedesId} /></div>
    <section className="bw-synthesis"><h4>Current direction</h4><p>{row.currentDirection}</p><h4>Watch next</h4><p>{row.watchNext ?? "기록 없음"}</p></section>
    <dl className="bw-meta bw-meta-grid">
      <div><dt>As of</dt><dd>{dateTime(row.asOf)}</dd></div>
      <div><dt>Coverage (stored)</dt><dd>Evidence {row.evidenceCount} · 출처 {row.sourceCount}</dd></div>
      <div><dt>Confidence</dt><dd>{row.confidence === null ? "기록 없음" : row.confidence.toFixed(2)}</dd></div>
      <div><dt>Reviewed</dt><dd>{row.reviewedBy ? `${row.reviewedBy} · ${dateTime(row.reviewedAt)}` : "미검수"}</dd></div>
      <div><dt>Current snapshot</dt><dd>{current ? (current.id === row.id ? "이 Snapshot" : `rev ${current.revision}: ${current.headline}`) : "없음"}</dd></div>
    </dl>
    <Uncertainties items={row.uncertainties} />
    <h4 className="bw-section-title">Supporting takes · {LAYER.interpretation} <span>{takes.length}</span></h4>
    {takes.length ? <ul className="bw-rows">{takes.map(t => <li key={t.id}><p><button type="button" className="bw-link" onClick={() => onNavigate("analysis:takes", t.id)}>{t.whyItMayMatter}</button></p><span><StatusLabel value={t.status} /></span></li>)}</ul> : <Empty>연결된 Take가 없습니다. Take 없이 게시할 수 없습니다.</Empty>}
    <h4 className="bw-section-title">Related patterns <span>{patterns.length}</span></h4>
    <ul className="bw-rows">{patterns.map(p => <li key={p.id}><p><button type="button" className="bw-link" onClick={() => onNavigate("analysis:patterns", p.id)}>{p.title}</button></p><span><StatusLabel value={p.status} /></span></li>)}</ul>
    <h4 className="bw-section-title">Related movements <span>{movements.length}</span></h4>
    <ul className="bw-rows">{movements.map(m => <li key={m.id}><p><button type="button" className="bw-link" onClick={() => onNavigate("movements", m.id)}>{m.title}</button></p><span>{day(m.occurredOn)}</span></li>)}</ul>
    {publishActions("snapshot", row, `Snapshot: ${row.headline}`, [current && current.id !== row.id ? `게시하면 current Snapshot이 '${current.headline}'에서 이 Snapshot으로 전환됩니다.` : "게시하면 이 브랜드의 current Snapshot으로 지정됩니다.", "게시자는 reviewed_by로 기록됩니다."], view)}
    <ReviewHistory events={view.events} targetIds={[row.id]} />
  </>
}

function PublicPreview({ row, view }: { row: SnapshotView | undefined; view: AdminView }) {
  if (!row) return <aside className="bw-context"><p className="bw-eyebrow">PUBLIC PREVIEW</p><Empty>게시된 브랜드 Snapshot이 없습니다.</Empty></aside>
  return <aside className="bw-context bw-preview" aria-label="Public preview">
    <p className="bw-eyebrow">PUBLIC PREVIEW · 실제 공개 페이지 아님</p>
    <article>
      <p className="bw-preview-brand">BRAND WATCH · {entityName(view, row.entityId)}</p>
      <h3>{row.headline}</h3>
      <p>{row.currentDirection}</p>
      {row.watchNext && <><h4>다음에 볼 신호</h4><p>{row.watchNext}</p></>}
      <footer>{day(row.asOf)} 기준 · 근거 {row.evidenceCount}건 · 출처 {row.sourceCount}곳 · MarkLens 해석 포함</footer>
    </article>
  </aside>
}

export default function AnalysisView({ view, brand, kind, onKind, selectedId, onSelect, onNavigate }: { view: AdminView; brand: string; kind: AnalysisKind; onKind: (kind: AnalysisKind) => void; selectedId: string | null; onSelect: (id: string) => void; onNavigate: (tab: string, id: string) => void }) {
  const [status, setStatus] = useState("all")
  const rows = useMemo(() => byBrand<PatternView | TakeView | SnapshotView>(view[kind], brand).filter(row => status === "all" || row.status === status), [view, kind, brand, status])
  const selected = rows.find(row => row.id === selectedId) ?? (view[kind] as (PatternView | TakeView | SnapshotView)[]).find(row => row.id === selectedId) ?? rows[0]
  const empty = { patterns: "아직 생성된 Pattern이 없습니다.", takes: "아직 생성된 Take가 없습니다.", snapshots: "게시된 브랜드 Snapshot이 없습니다." }[kind]
  const titleOf = (row: PatternView | TakeView | SnapshotView) => "title" in row ? row.title : "headline" in row ? row.headline : row.whyItMayMatter
  return <>
    <div className="bw-subtabs" role="group" aria-label="Analysis 단계">{(["patterns", "takes", "snapshots"] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => onKind(value)}>{{ patterns: "Patterns", takes: "Takes", snapshots: "Snapshots" }[value]}<small>{byBrand<PatternView | TakeView | SnapshotView>(view[value], brand).length}</small></button>)}</div>
    <div className="bw-workbench">
      <section className="bw-queue" aria-label={`${kind} list`}>
        <div className="bw-queue-filters"><div className="bw-segmented" role="group" aria-label="상태 필터">{STATUSES.map(value => <button type="button" key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === "all" ? "전체" : value}</button>)}</div><p className="bw-muted">{rows.length}건</p></div>
        {rows.length === 0 ? <Empty>{empty}</Empty> : <ul className="bw-list">{rows.map(row => <li key={row.id}><button type="button" aria-pressed={selected?.id === row.id} onClick={() => onSelect(row.id)}>
          <span className="bw-list-meta">{entityName(view, row.entityId)} · rev {row.revision}{"isCurrent" in row && row.isCurrent ? " · CURRENT" : ""}</span>
          <strong>{titleOf(row)}</strong>
          <span className="bw-list-tags"><StatusLabel value={row.status} /><HealthBadge health={row.health} /></span>
        </button></li>)}</ul>}
      </section>
      <section className="bw-detail" aria-label={`${kind} detail`}>
        {!selected ? <Empty>{empty}</Empty> : kind === "patterns" ? <PatternDetail row={selected as PatternView} view={view} onNavigate={onNavigate} /> : kind === "takes" ? <TakeDetail row={selected as TakeView} view={view} onNavigate={onNavigate} /> : <SnapshotDetail row={selected as SnapshotView} view={view} onNavigate={onNavigate} />}
      </section>
      <div className="bw-side">{kind === "snapshots" ? <PublicPreview row={selected as SnapshotView | undefined} view={view} /> : <BrandContext view={view} entity={view.entities.find(entity => entity.id === (selected?.entityId ?? brand))} onSelect={onNavigate} />}</div>
    </div>
  </>
}
