import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import type { PublicBrandState, PublicMovement, PublicPattern, PublicSnapshot, PublicSource, PublicTake, PublicDate } from "@/lib/brand-watch/public/types"
import { DATE_BASIS_LABELS, MOVEMENT_TYPE_LABELS, PROVIDER_TYPE_LABELS, formatDay, formatPublicDate, isoDay } from "./format"

type Available = Extract<PublicBrandState, { kind: "available" }>

// Server-rendered research dossier: Snapshot → Recent Moves (FACT) → Observed Patterns → MarkLens Take → Sources.
// Each layer carries its own text label; colour is never the only signal.
export default function BrandDossier({ state }: { state: PublicBrandState }) {
  const { brand } = state
  const available = state.kind === "available" ? state : null
  const sections = available ? [
    { id: "snapshot", label: "Snapshot" },
    { id: "moves", label: "Recent Moves" },
    { id: "patterns", label: "Patterns" },
    { id: "take", label: "MarkLens Take" },
    { id: "sources", label: "Sources" },
  ] : []
  return (
    <article className="bw-public" aria-labelledby="bw-title">
      <header className="bw-hero">
        <div className="ml-container">
          <nav className="bw-crumb" aria-label="이동 경로"><Link href="/brands"><ArrowLeft size={14} aria-hidden="true" /> Brand Watch</Link></nav>
          <p className="ml-eyebrow bw-hero-eyebrow">BRAND WATCH · <span className="bw-hero-category">{brand.category}</span></p>
          <h1 id="bw-title">{brand.name}<span className="ml-blue">.</span></h1>
          <p className="bw-hero-ko">{brand.nameKo}</p>
          {available?.lastUpdate ? <p className="bw-hero-update">최근 확인된 움직임 · <time dateTime={isoDay(available.lastUpdate)}>{formatDay(available.lastUpdate)}</time> 기준</p> : null}
          {sections.length ? <nav className="bw-toc" aria-label="이 페이지의 구성"><ol>{sections.map((section, index) => <li key={section.id}><a href={`#${section.id}`}><span className="ml-index">{String(index + 1).padStart(2, "0")}</span>{section.label}</a></li>)}</ol></nav> : null}
        </div>
      </header>
      {state.kind === "error" ? <Notice title="Brand Watch 데이터를 불러오지 못했습니다." body="잠시 후 다시 확인해 주세요. 불러오지 못한 동안에는 어떤 요약이나 수치도 표시하지 않습니다." /> : null}
      {state.kind === "unavailable" ? <Notice title="아직 공개된 Brand Watch 데이터가 없습니다." body={`${brand.nameKo}의 움직임은 검수를 거쳐 공개됩니다. 공개 전에는 요약이나 해석을 미리 보여주지 않습니다.`} /> : null}
      {available ? <Body state={available} /> : null}
    </article>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return <section className="bw-notice" role="status"><div className="ml-container"><h2>{title}</h2><p>{body}</p><Link className="ml-text-link" href="/brands">다른 브랜드 보기 <ArrowUpRight size={15} aria-hidden="true" /></Link></div></section>
}

function Body({ state }: { state: Available }) {
  return (
    <>
      <ReadingGuide />
      <SnapshotSection snapshot={state.snapshot} hasMoves={state.movements.length > 0} />
      <MovesSection movements={state.movements} themes={state.themes} />
      <PatternsSection patterns={state.patterns} />
      <TakesSection takes={state.takes} />
      <SourcesSection sources={state.sources} />
      {state.relatedInsights.length ? (
        <section className="bw-section bw-related" aria-labelledby="related-title">
          <div className="ml-container">
            <Heading eyebrow="RELATED INSIGHTS" id="related-title" title="이 움직임을 다룬 인사이트" />
            <ul className="bw-related-list">{state.relatedInsights.map(row => <li key={row.slug}><Link href={`/insights/${row.slug}`}>{row.title}<ArrowUpRight size={15} aria-hidden="true" /></Link></li>)}</ul>
          </div>
        </section>
      ) : null}
    </>
  )
}

function Heading({ eyebrow, id, title, deck }: { eyebrow: string; id: string; title: string; deck?: string }) {
  return <div className="bw-heading"><p className="ml-eyebrow">{eyebrow}</p><h2 id={id}>{title}<span className="ml-blue">.</span></h2>{deck ? <p className="bw-deck">{deck}</p> : null}</div>
}

function ReadingGuide() {
  return (
    <section className="bw-guide" aria-labelledby="guide-title">
      <div className="ml-container">
        <h2 id="guide-title" className="sr-only">이 페이지를 읽는 법</h2>
        <ol>
          <li className="bw-guide-fact"><span className="bw-label bw-label-fact">FACT</span><p>공개 자료에서 확인된 사실. 출처 번호를 눌러 원문까지 따라갈 수 있습니다.</p></li>
          <li className="bw-guide-pattern"><span className="bw-label bw-label-pattern">OBSERVED PATTERN</span><p>서로 다른 둘 이상의 움직임에서 반복해서 관찰된 방향.</p></li>
          <li className="bw-guide-take"><span className="bw-label bw-label-take">MARKLENS TAKE</span><p>사실과 패턴을 바탕으로 한 MarkLens의 해석. 사실이 아닙니다.</p></li>
        </ol>
      </div>
    </section>
  )
}

function Refs({ refs, label = "출처" }: { refs: number[]; label?: string }) {
  if (!refs.length) return null
  return <p className="bw-refs"><span>{label}</span>{refs.map(ref => <a key={ref} href={`#source-${ref}`} aria-label={`출처 ${ref}번으로 이동`}>[{ref}]</a>)}</p>
}

function DateLabel({ date }: { date: PublicDate | null }) {
  if (!date) return <span className="bw-date bw-date-unknown">날짜 미상</span>
  const basis = DATE_BASIS_LABELS[date.basis]
  return <span className="bw-date"><time dateTime={date.date.slice(0, date.precision === "year" ? 4 : date.precision === "month" ? 7 : 10)}>{formatPublicDate(date)}</time>{basis ? <small>{basis}</small> : null}</span>
}

function SnapshotSection({ snapshot, hasMoves }: { snapshot: PublicSnapshot | null; hasMoves: boolean }) {
  return (
    <section id="snapshot" className="bw-section bw-snapshot" aria-labelledby="snapshot-title">
      <div className="ml-container">
        {snapshot ? (
          <>
            <div className="bw-snapshot-top">
              <p className="ml-eyebrow">CURRENT SYNTHESIS · BRAND SNAPSHOT</p>
              <p className="bw-asof"><time dateTime={isoDay(snapshot.asOf)}>{formatDay(snapshot.asOf)}</time> 기준</p>
            </div>
            <h2 id="snapshot-title" className="bw-snapshot-headline">{snapshot.headline}</h2>
            {snapshot.asOfOnly ? <p className="bw-asof-note">이 요약은 {formatDay(snapshot.asOf)} 기준입니다. 이후의 움직임은 반영되지 않았을 수 있습니다.</p> : null}
            <div className="bw-snapshot-grid">
              <div><p className="bw-label">CURRENT DIRECTION</p><p className="bw-snapshot-text">{snapshot.currentDirection}</p></div>
              {snapshot.watchNext ? <div><p className="bw-label">WATCH NEXT</p><p className="bw-snapshot-text">{snapshot.watchNext}</p></div> : null}
            </div>
            <p className="bw-snapshot-basis">
              MarkLens가 아래의 사실·패턴·해석을 종합한 현재 요약입니다 · 근거 {snapshot.evidenceCount}건 · 출처 {snapshot.sourceCount}건
              {snapshot.takeAnchors.length ? <> · 바탕이 된 해석: {snapshot.takeAnchors.map((take, index) => <span key={take.anchor}>{index ? ", " : ""}<a href={`#${take.anchor}`}>{take.patternTitle}</a></span>)}</> : null}
            </p>
          </>
        ) : (
          <>
            <p className="ml-eyebrow">CURRENT SYNTHESIS · BRAND SNAPSHOT</p>
            <h2 id="snapshot-title" className="bw-empty-title">현재 공개된 Brand Snapshot이 없습니다.</h2>
            <p className="bw-empty">{hasMoves ? "아래에서 공개 자료로 확인된 움직임을 먼저 볼 수 있습니다." : "검수를 마친 요약이 공개되면 이곳에 표시됩니다."}</p>
          </>
        )}
      </div>
    </section>
  )
}

function MovesSection({ movements, themes }: { movements: PublicMovement[]; themes: Available["themes"] }) {
  return (
    <section id="moves" className="bw-section bw-moves" aria-labelledby="moves-title">
      <div className="ml-container">
        <Heading eyebrow="FACT · RECENT MOVES" id="moves-title" title="최근 확인된 움직임" deck="공개 자료에서 확인된 사실입니다. 같은 사건을 다룬 여러 보도는 하나의 움직임으로 묶었습니다." />
        {themes.length ? <div className="bw-themes"><p className="bw-label">THEMES</p><ul>{themes.map(theme => <li key={theme.slug}>{theme.name}</li>)}</ul></div> : null}
        {movements.length ? (
          <ol className="bw-move-list">
            {movements.map(movement => (
              <li key={movement.id} id={movement.anchor} className="bw-move">
                <DateLabel date={movement.date} />
                <div className="bw-move-body">
                  <p className="bw-move-kind"><span className="bw-label bw-label-fact">FACT</span><span>{MOVEMENT_TYPE_LABELS[movement.movementType] ?? movement.movementType}</span></p>
                  <h3>{movement.title}</h3>
                  <p className="bw-move-summary">{movement.summary}</p>
                  {movement.themes.length ? <ul className="bw-tags" aria-label="테마">{movement.themes.map(theme => <li key={theme.slug}>{theme.name}</li>)}</ul> : null}
                  <Refs refs={movement.sourceRefs} label={`출처 ${movement.sourceRefs.length}건${movement.providerCount > 1 ? ` · 매체 ${movement.providerCount}곳` : ""}`} />
                  <details className="bw-evidence">
                    <summary>확인된 사실 {movement.facts.length}건 보기</summary>
                    <ul>{movement.facts.map(fact => <li key={fact.id}><p>{fact.fact}</p><p className="bw-evidence-meta">{fact.date ? <DateLabel date={fact.date} /> : null}{fact.sourceRef ? <a href={`#source-${fact.sourceRef}`} aria-label={`출처 ${fact.sourceRef}번으로 이동`}>[{fact.sourceRef}]</a> : null}</p></li>)}</ul>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="bw-empty">아직 공개된 움직임이 없습니다.</p>}
      </div>
    </section>
  )
}

function PatternsSection({ patterns }: { patterns: PublicPattern[] }) {
  return (
    <section id="patterns" className="bw-section bw-patterns" aria-labelledby="patterns-title">
      <div className="ml-container">
        <Heading eyebrow="OBSERVED PATTERN" id="patterns-title" title="반복해서 나타난 움직임" deck="서로 다른 둘 이상의 움직임에서 반복적으로 관찰된 방향입니다. 해석이 아니라 관찰입니다." />
        {patterns.length ? (
          <div className="bw-pattern-list">
            {patterns.map(pattern => (
              <article key={pattern.id} id={pattern.anchor} className="bw-pattern" aria-labelledby={`${pattern.anchor}-title`}>
                <p className="bw-pattern-top"><span className="bw-label bw-label-pattern">OBSERVED PATTERN</span><span className="bw-window"><time dateTime={pattern.windowStart}>{formatDay(pattern.windowStart)}</time> – <time dateTime={pattern.windowEnd}>{formatDay(pattern.windowEnd)}</time></span></p>
                <h3 id={`${pattern.anchor}-title`}>{pattern.title}</h3>
                <p className="bw-pattern-text">{pattern.description}</p>
                {pattern.asOfOnly ? <p className="bw-asof-note">관찰 기간이 지난 패턴입니다 · {formatDay(pattern.windowEnd)} 기준</p> : null}
                <div className="bw-chain">
                  <p className="bw-label">근거가 된 움직임 {pattern.movementAnchors.length}건</p>
                  <ol>{pattern.movementAnchors.map(movement => <li key={movement.anchor}><a href={`#${movement.anchor}`}>{movement.title}</a></li>)}</ol>
                </div>
                <Refs refs={pattern.sourceRefs} />
              </article>
            ))}
          </div>
        ) : <p className="bw-empty">아직 공개된 Observed Pattern이 없습니다.</p>}
      </div>
    </section>
  )
}

function TakesSection({ takes }: { takes: PublicTake[] }) {
  return (
    <section id="take" className="bw-section bw-takes" aria-labelledby="take-title">
      <div className="ml-container">
        <Heading eyebrow="MARKLENS TAKE · INTERPRETATION" id="take-title" title="MarkLens의 해석" deck="아래 내용은 사실(FACT)이 아니라, 위의 Observed Pattern을 바탕으로 한 MarkLens의 해석입니다." />
        {takes.length ? takes.map(take => (
          <article key={take.id} id={take.anchor} className="bw-take" aria-label={`MarkLens Take: ${take.pattern.title}`}>
            <p className="bw-take-top"><span className="bw-label bw-label-take">MARKLENS TAKE</span><span>기반 패턴 <a href={`#${take.pattern.anchor}`}>{take.pattern.title}</a></span></p>
            {take.asOfOnly ? <p className="bw-asof-note">기반 패턴의 관찰 기간이 지난 해석입니다.</p> : null}
            <dl>
              <div><dt>WHAT WE SEE</dt><dd>{take.whatWeSee}</dd></div>
              <div><dt>WHY IT MAY MATTER</dt><dd>{take.whyItMayMatter}</dd></div>
              <div><dt>WHAT TO WATCH NEXT</dt><dd>{take.whatToWatchNext}</dd></div>
            </dl>
            <Refs refs={take.sourceRefs} label="해석의 근거 출처" />
          </article>
        )) : <p className="bw-empty">아직 공개된 MarkLens Take가 없습니다.</p>}
      </div>
    </section>
  )
}

function SourcesSection({ sources }: { sources: PublicSource[] }) {
  return (
    <section id="sources" className="bw-section bw-sources" aria-labelledby="sources-title">
      <div className="ml-container">
        <Heading eyebrow="SOURCES" id="sources-title" title="출처" deck="원문을 옮기지 않고 제목과 링크만 표시합니다. 전문은 각 매체에서 확인할 수 있습니다." />
        {sources.length ? (
          <ol className="bw-source-list">
            {sources.map(source => (
              <li key={source.ref} id={`source-${source.ref}`}>
                <span className="bw-source-ref" aria-hidden="true">[{source.ref}]</span>
                <div>
                  <p className="bw-source-meta"><span>{source.provider}</span><span>{PROVIDER_TYPE_LABELS[source.providerType] ?? "매체"}</span>{source.publishedAt ? <time dateTime={isoDay(source.publishedAt)}>{formatDay(source.publishedAt)}</time> : null}</p>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="bw-source-link">{source.title}<span className="sr-only"> — {source.provider} 원문, 새 창에서 열림</span><ArrowUpRight size={14} aria-hidden="true" /></a>
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="bw-empty">표시할 출처가 없습니다.</p>}
      </div>
    </section>
  )
}
