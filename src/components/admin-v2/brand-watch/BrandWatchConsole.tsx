"use client"

import { useState } from "react"
import type { AdminView } from "@/lib/brand-watch/admin/view"
import { ADMIN_TABS as TABS, NEW_SOURCE_WINDOW_DAYS, type AdminTab as Tab, type AnalysisKind } from "@/lib/brand-watch/admin/constants"
import InboxView from "./InboxView"
import MovementsView from "./MovementsView"
import AnalysisView from "./AnalysisView"
import { EntitiesView, SourcesView } from "./DirectoryViews"
import { dateTime } from "./shared"

const TAB_LABEL: Record<Tab, string> = { inbox: "Inbox", movements: "Movements", analysis: "Analysis", entities: "Entities", sources: "Sources" }

export default function BrandWatchConsole({ view, initial }: { view: AdminView | null; initial: { tab: Tab; kind: AnalysisKind; brand: string; id: string | null } }) {
  const [tab, setTab] = useState<Tab>(initial.tab), [kind, setKind] = useState<AnalysisKind>(initial.kind)
  const [brand, setBrand] = useState(initial.brand), [selected, setSelected] = useState<string | null>(initial.id)

  // Shareable URL state without a server round trip (Next syncs native history updates).
  function sync(next: { tab?: Tab; kind?: AnalysisKind; brand?: string; id?: string | null }) {
    const params = new URLSearchParams()
    const value = { tab, kind, brand, id: selected, ...next }
    if (value.tab !== "inbox") params.set("tab", value.tab)
    if (value.tab === "analysis") params.set("kind", value.kind)
    if (value.brand !== "all") params.set("brand", value.brand)
    if (value.id) params.set("id", value.id)
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`)
  }
  const select = (id: string) => { setSelected(id); sync({ id }) }
  const navigate = (target: string, id: string) => {
    const [nextTab, nextKind] = target.split(":") as [Tab, AnalysisKind | undefined]
    setTab(nextTab); setSelected(id)
    if (nextKind) setKind(nextKind)
    sync({ tab: nextTab, kind: nextKind ?? kind, id })
  }

  return <div className="bw-console">
    <header className="bw-header">
      <div><p className="bw-eyebrow">INTELLIGENCE / BRAND WATCH</p><h2>Brand Watch</h2><span>브랜드 움직임을 구조화하고 검수하는 운영 화면</span></div>
      {view && <label className="bw-brand-filter">브랜드<select value={brand} onChange={event => { setBrand(event.target.value); setSelected(null); sync({ brand: event.target.value, id: null }) }}>
        <option value="all">전체 브랜드</option>{view.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}{entity.inDatabase ? "" : " (DB 미등록)"}</option>)}
      </select></label>}
    </header>
    {!view ? <div className="admin-content-error" role="alert"><p>Brand Watch 데이터를 불러오지 못했습니다.</p><span className="bw-muted">이 환경에 Brand Watch migration(018–021)이 적용되었는지 확인하세요. 오류 상세는 표시하지 않습니다.</span></div> : <>
      <section className="admin-snapshot bw-kpis" aria-label="Brand Watch 상태">
        <div><p>신규 소스</p><strong>{view.kpis.newSources}</strong><span>최근 {NEW_SOURCE_WINDOW_DAYS}일 수집{view.truncated.sources ? " · 최근 200건 기준" : ""}</span></div>
        <div><p>검수 필요</p><strong>{view.kpis.reviewNeeded}</strong><span>대기 Evidence + 초안 Movement·분석</span></div>
        <div><p>Published Moves</p><strong>{view.kpis.publishedMovements}</strong><span>게시된 현재 Movement</span></div>
        <div><p>Stale Snapshot</p><strong>{view.kpis.staleSnapshots}</strong><span>재검수가 필요한 게시 Snapshot</span></div>
      </section>
      <p className="bw-scope">기준 {dateTime(view.generatedAt)}{view.healthUnavailableEntityIds.length ? ` · Health 계산 실패 브랜드 ${view.healthUnavailableEntityIds.length}개` : ""}</p>
      <div className="bw-tabs" role="tablist" aria-label="Brand Watch 영역">{TABS.map(value => <button type="button" role="tab" key={value} id={`bw-tab-${value}`} aria-selected={tab === value} aria-controls="bw-panel" onClick={() => { setTab(value); setSelected(null); sync({ tab: value, id: null }) }}>{TAB_LABEL[value]}</button>)}</div>
      <div id="bw-panel" role="tabpanel" aria-labelledby={`bw-tab-${tab}`}>
        {tab === "inbox" && <InboxView view={view} brand={brand} selectedId={selected} onSelect={select} onNavigate={navigate} />}
        {tab === "movements" && <MovementsView view={view} brand={brand} selectedId={selected} onSelect={select} onNavigate={navigate} />}
        {tab === "analysis" && <AnalysisView view={view} brand={brand} kind={kind} onKind={value => { setKind(value); setSelected(null); sync({ kind: value, id: null }) }} selectedId={selected} onSelect={select} onNavigate={navigate} />}
        {tab === "entities" && <EntitiesView view={view} brand={brand} />}
        {tab === "sources" && <SourcesView view={view} brand={brand} />}
      </div>
    </>}
  </div>
}
