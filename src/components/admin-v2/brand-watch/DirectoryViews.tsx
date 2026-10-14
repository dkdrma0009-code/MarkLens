"use client"

import type { AdminView } from "@/lib/brand-watch/admin/view"
import { Empty, dateTime, day } from "./shared"

// Operational status only; entity CRUD is out of scope.
export function EntitiesView({ view, brand }: { view: AdminView; brand: string }) {
  const rows = view.entities.filter(entity => brand === "all" || entity.id === brand)
  if (!rows.length) return <Empty>표시할 브랜드가 없습니다.</Empty>
  return <div className="admin-content-table-wrap bw-table-wrap"><table className="admin-content-table bw-table">
    <caption className="sr-only">Brand Watch entities and operating status</caption>
    <thead><tr>{["Entity", "Type", "Aliases", "Watch", "Public", "SEO", "Latest meaningful update", "Current snapshot"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(entity => {
      const current = view.snapshots.find(row => row.id === entity.currentSnapshotId)
      return <tr key={entity.id}>
        <td data-label="Entity"><h3>{entity.name}</h3><small>{entity.nameKo} · {entity.slug}{entity.inDatabase ? "" : " · DB 미등록 (launch registry)"}</small></td>
        <td data-label="Type">{entity.entityType}</td>
        <td data-label="Aliases">{entity.aliases.length ? entity.aliases.join(", ") : "—"}</td>
        <td data-label="Watch">{entity.watchStatus ?? "프로필 없음"}</td>
        <td data-label="Public">{entity.publicStatus ?? "—"}</td>
        <td data-label="SEO">{entity.seoStatus ?? "—"}</td>
        <td data-label="Latest meaningful update">{entity.lastMeaningfulUpdateAt ? dateTime(entity.lastMeaningfulUpdateAt) : "기록 없음"}<small>최근 Movement {day(entity.latestMovementAt)}</small></td>
        <td data-label="Current snapshot">{current ? <>{current.headline}<small>rev {current.revision} · {day(current.asOf)} 기준</small></> : "게시된 Snapshot 없음"}</td>
      </tr>
    })}</tbody>
  </table></div>
}

// Provider registry (code-owned config) joined with stored provider rows. No collection job exists, so no
// error log is shown as if it existed.
export function SourcesView({ view, brand }: { view: AdminView; brand: string }) {
  const slug = brand === "all" ? null : view.entities.find(entity => entity.id === brand)?.slug
  const rows = view.providers.filter(provider => !slug || provider.entitySlug === slug)
  if (!rows.length) return <Empty>등록된 소스 제공처가 없습니다.</Empty>
  return <>
    <p className="bw-note">검증 상태는 코드 레지스트리 값입니다. 실시간 수집 작업은 아직 활성화되지 않았으며, 수집 오류 기록은 저장되지 않습니다.</p>
    <div className="admin-content-table-wrap bw-table-wrap"><table className="admin-content-table bw-table">
      <caption className="sr-only">Brand Watch source providers</caption>
      <thead><tr>{["Provider", "Linked brand", "Type", "Verification", "Ingestion", "Active", "Latest collection"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(provider => <tr key={provider.key}>
        <td data-label="Provider"><h3>{provider.name}</h3><small>{provider.domain}{provider.inRegistry ? "" : " · 레지스트리 외 DB 항목"}</small></td>
        <td data-label="Linked brand">{provider.entitySlug ? view.entities.find(entity => entity.slug === provider.entitySlug)?.name ?? provider.entitySlug : "—"}</td>
        <td data-label="Type">{provider.providerType}</td>
        <td data-label="Verification">{provider.verification ? <><span className={`bw-status bw-status-${provider.verification === "VERIFIED" ? "approved" : "pending"}`}>{provider.verification}</span><small>{provider.verifiedAt ? `${provider.verifiedAt} 확인 · ` : ""}robots {provider.robotsConfirmed ? "확인" : "미확인"}</small>{provider.verificationNote && <small>{provider.verificationNote}</small>}</> : "—"}</td>
        <td data-label="Ingestion">{provider.ingestionMethod ?? (provider.adapter ? `${provider.adapter} adapter (DB 미등록)` : "—")}</td>
        <td data-label="Active">{provider.active === null ? "DB 미등록" : provider.active ? "활성" : "비활성"}</td>
        <td data-label="Latest collection">{provider.latestCollectedAt ? dateTime(provider.latestCollectedAt) : "수집 기록 없음"}<small>불러온 소스 {provider.loadedSourceCount}건</small></td>
      </tr>)}</tbody>
    </table></div>
  </>
}
