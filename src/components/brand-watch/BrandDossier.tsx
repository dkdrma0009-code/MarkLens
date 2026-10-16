import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { keyMovements, publicSignal } from "@/lib/brand-watch/public/view"
import type { PublicBrandState, PublicMovement, PublicPattern, PublicSignal, PublicSnapshot, PublicSource, PublicTake, PublicDate } from "@/lib/brand-watch/public/types"
import { EvidenceImage, VisualCredit } from "./EvidenceImage"
import { BRAND_LOGOS } from "./logos"
import { DATE_BASIS_LABELS, MOVEMENT_TYPE_LABELS, PROVIDER_TYPE_LABELS, formatDay, formatPublicDate, isoDay, keepDots } from "./format"

type Available = Extract<PublicBrandState, { kind: "available" }>

// Editorial brand page: Hero (brand, observed direction, evidence) → Current signal → Key moves → Pattern reveal →
// MarkLens Take → Timeline → Sources.
// FACT / OBSERVED PATTERN / MARKLENS TAKE stay text-labelled layers; images are the sources' own visual evidence.
// Nothing here adds, merges or rewrites data.
export default function BrandDossier({ state }: { state: PublicBrandState }) {
  const { brand } = state
  const available = state.kind === "available" ? state : null
  const signal = available ? publicSignal(available) : null
  // Hero evidence: the most recent public fact with its own image (Key Moves then leads with the strongest-supported).
  const lead = available?.movements.find(row => row.visual) ?? null
  const logo = BRAND_LOGOS[brand.slug]
  return (
    <article className="bw-public" aria-labelledby="bw-title">
      <header className={`bw-hero${lead ? " bw-hero-has-visual" : ""}`}>
        <div className="ml-container">
          <nav className="bw-crumb" aria-label="이동 경로"><Link href="/brands"><ArrowLeft size={14} aria-hidden="true" /> Brand Watch</Link></nav>
          <div className="bw-hero-grid">
            <div className="bw-hero-brand">
              <p className="ml-eyebrow bw-hero-eyebrow">BRAND WATCH / <span className="bw-hero-category">{brand.category}</span></p>
              {/* The brand's own dark-ground wordmark when one exists; its alt text keeps the heading's name. */}
              {logo ? (
                <h1 id="bw-title" className="bw-hero-logo" style={{ "--bw-logo-h": `${logo.displayHeight}px` } as CSSProperties}>
                  <Image src={logo.src} alt={brand.displayName} width={logo.width} height={logo.height} unoptimized preload />
                </h1>
              ) : <h1 id="bw-title">{brand.displayName}<span className="ml-blue">.</span></h1>}
              <p className="bw-hero-secondary">{brand.displayNameSecondary}</p>
              {signal ? <HeroSignal signal={signal} /> : null}
              {available?.lastUpdate ? <p className="bw-hero-updated">Updated <time dateTime={isoDay(available.lastUpdate)}>{formatDay(available.lastUpdate)}</time></p> : null}
            </div>
            {lead?.visual ? (
              <figure className="bw-hero-evidence">
                <div className="bw-hero-frame"><EvidenceImage visual={lead.visual} width={1200} eager /></div>
                <figcaption>
                  <span className="bw-hero-evidence-meta"><span className="bw-label bw-label-fact">FACT</span>{lead.date ? <span>{formatPublicDate(lead.date)}</span> : null}</span>
                  <a href={`#${lead.anchor}`} className="bw-hero-evidence-title">{keepDots(lead.title)}</a>
                  <VisualCredit visual={lead.visual} />
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      </header>
      {state.kind === "error" ? <Notice title="Brand Watch 데이터를 불러오지 못했습니다." body="잠시 후 다시 확인해 주세요. 불러오지 못한 동안에는 어떤 요약이나 수치도 표시하지 않습니다." /> : null}
      {state.kind === "unavailable" ? <Notice title="아직 공개된 Brand Watch 데이터가 없습니다." body={`${brand.nameKo}의 움직임은 검수를 거쳐 공개됩니다. 공개 전에는 요약이나 해석을 미리 보여주지 않습니다.`} /> : null}
      {available ? <Body state={available} hero={lead} /> : null}
    </article>
  )
}

// Three different claims, three different labels: a Pattern is never presented as a Snapshot.
const SIGNAL_LABELS: Record<PublicSignal["kind"], { label: string; note: string | null }> = {
  snapshot: { label: "Current signal", note: null },
  pattern: { label: "Observed direction", note: "공개된 Snapshot이 없어, 반복 관찰된 Observed Pattern을 표시합니다." },
  movement: { label: "Latest move", note: "공개된 Snapshot과 Pattern이 없어, 가장 최근 확인된 움직임을 표시합니다." },
}
function HeroSignal({ signal }: { signal: PublicSignal }) {
  const { label, note } = SIGNAL_LABELS[signal.kind]
  return (
    <div className={`bw-hero-signal bw-hero-signal-${signal.kind}`}>
      <p className="bw-hero-signal-label">{label}</p>
      <p className="bw-hero-signal-text">{signal.kind === "snapshot" ? keepDots(signal.text) : <a href={`#${signal.anchor}`}>{keepDots(signal.text)}</a>}</p>
      {note ? <p className="bw-hero-signal-note">{note}</p> : null}
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return <section className="bw-notice" role="status"><div className="ml-container"><h2>{title}</h2><p>{body}</p><Link className="ml-text-link" href="/brands">다른 브랜드 보기 <ArrowUpRight size={15} aria-hidden="true" /></Link></div></section>
}

// One visual, at most two appearances in the reading flow. The hero's Movement is already featured with its evidence,
// so Key Moves ranks the remaining Movements (it is not hidden: the hero caption and the timeline still list it).
// The timeline is the archive, not a replay: it shows an image only for a Movement not pictured above.
function Body({ state, hero }: { state: Available; hero: PublicMovement | null }) {
  const pool = state.movements.filter(row => row.id !== hero?.id)
  const key = keyMovements(pool.length ? pool : state.movements, state.patterns)
  const pictured = new Set([...(hero ? [hero.id] : []), ...key.filter(row => row.visual).map(row => row.id)])
  return (
    <>
      <SnapshotSection snapshot={state.snapshot} hasMoves={state.movements.length > 0} />
      <KeyMovesSection keyMoves={key} />
      <PatternsSection patterns={state.patterns} movements={state.movements} />
      <TakesSection takes={state.takes} />
      <TimelineSection movements={state.movements} themes={state.themes} pictured={pictured} />
      <SourcesSection sources={state.sources} imageRefs={new Set(state.movements.flatMap(row => row.visual ? [row.visual.sourceRef] : []))} />
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

function Refs({ refs, label = "출처" }: { refs: number[]; label?: string }) {
  if (!refs.length) return null
  return <p className="bw-refs"><span>{label}</span>{refs.map(ref => <a key={ref} href={`#source-${ref}`} aria-label={`출처 ${ref}번으로 이동`}>[{ref}]</a>)}</p>
}

function DateLabel({ date }: { date: PublicDate | null }) {
  if (!date) return <span className="bw-date bw-date-unknown">날짜 미상</span>
  const basis = DATE_BASIS_LABELS[date.basis]
  return <span className="bw-date"><time dateTime={date.date.slice(0, date.precision === "year" ? 4 : date.precision === "month" ? 7 : 10)}>{formatPublicDate(date)}</time>{basis ? <small>{basis}</small> : null}</span>
}

const typeLabel = (movement: PublicMovement) => MOVEMENT_TYPE_LABELS[movement.movementType] ?? movement.movementType
const pad = (value: number) => String(value).padStart(2, "0")

function SnapshotSection({ snapshot, hasMoves }: { snapshot: PublicSnapshot | null; hasMoves: boolean }) {
  // No Snapshot: one quiet status line, so the page moves straight on to the published facts.
  if (!snapshot) return (
    <section id="snapshot" className="bw-snapshot-status" aria-labelledby="snapshot-title">
      <div className="ml-container">
        <p className="ml-eyebrow">SNAPSHOT</p>
        <h2 id="snapshot-title">현재 공개 Snapshot 없음</h2>
        <p>{hasMoves ? "아래에서 공개 자료로 확인된 움직임을 먼저 볼 수 있습니다." : "검수를 마친 요약이 공개되면 이곳에 표시됩니다."}</p>
      </div>
    </section>
  )
  return (
    <section id="snapshot" className="bw-section bw-snapshot" aria-labelledby="snapshot-title">
      <div className="ml-container">
        <div className="bw-snapshot-top">
          <p className="ml-eyebrow">CURRENT SIGNAL</p>
          <p className="bw-asof"><time dateTime={isoDay(snapshot.asOf)}>{formatDay(snapshot.asOf)}</time> 기준</p>
        </div>
        {/* The headline leads the hero; here it titles the section for assistive technology only. */}
        <h2 id="snapshot-title" className="sr-only">{snapshot.headline}</h2>
        {snapshot.asOfOnly ? <p className="bw-asof-note">이 요약은 {formatDay(snapshot.asOf)} 기준입니다. 이후의 움직임은 반영되지 않았을 수 있습니다.</p> : null}
        <div className="bw-snapshot-grid">
          <div className="bw-snapshot-direction"><h3>CURRENT DIRECTION</h3><p>{keepDots(snapshot.currentDirection)}</p></div>
          {snapshot.watchNext ? <div className="bw-snapshot-watch"><h3>WATCH NEXT</h3><p>{keepDots(snapshot.watchNext)}</p></div> : null}
        </div>
        <p className="bw-snapshot-basis">
          <span>근거 {snapshot.evidenceCount}건 · 출처 {snapshot.sourceCount}건을 종합한 현재 요약</span>
          {snapshot.takeAnchors.length ? <span>바탕이 된 해석 {snapshot.takeAnchors.map((take, index) => <span key={take.anchor}>{index ? ", " : ""}<a href={`#${take.anchor}`}>{take.patternTitle}</a></span>)}</span> : null}
        </p>
      </div>
    </section>
  )
}

// Composition follows the count: one feature, an asymmetric pair, or a lead with two supporting moves.
function KeyMovesSection({ keyMoves: key }: { keyMoves: PublicMovement[] }) {
  return (
    <section id="key-moves" className="bw-section bw-key" aria-labelledby="key-title">
      <div className="ml-container">
        <Heading eyebrow="KEY MOVES" id="key-title" title="지금 눈여겨볼 움직임" deck="반복 패턴과 여러 출처로 뒷받침된 공개 사실을 먼저 보여줍니다. 이미지는 각 출처가 게재한 것입니다." />
        {key.length ? (
          <ol className={`bw-key-grid bw-key-count-${key.length}`}>
            {key.map((movement, index) => (
              <li key={movement.id} className={`bw-key-signal${movement.visual ? " bw-key-has-visual" : ""}`}>
                <article aria-labelledby={`key-${movement.anchor}`}>
                  {movement.visual ? (
                    <figure className="bw-key-figure">
                      <div className="bw-key-frame"><EvidenceImage visual={movement.visual} width={index === 0 ? 1200 : 720} /></div>
                      <figcaption><VisualCredit visual={movement.visual} /></figcaption>
                    </figure>
                  ) : null}
                  <div className="bw-key-body">
                    <p className="bw-key-meta"><span className="bw-key-index">{pad(index + 1)}</span><span className="bw-label bw-label-fact">FACT</span><span className="bw-key-type">{typeLabel(movement)}</span><DateLabel date={movement.date} /></p>
                    <h3 id={`key-${movement.anchor}`} className="bw-key-title"><a href={`#${movement.anchor}`}>{keepDots(movement.title)}</a></h3>
                    <p className="bw-key-summary">{keepDots(movement.summary)}</p>
                    <Refs refs={movement.sourceRefs} label={`출처 ${movement.sourceRefs.length}건`} />
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : <p className="bw-empty">아직 공개된 움직임이 없습니다.</p>}
      </div>
    </section>
  )
}

// Signature moment: the supporting moves' own evidence, gathered by one bracket into the observed direction.
function PatternsSection({ patterns, movements }: { patterns: PublicPattern[]; movements: PublicMovement[] }) {
  const byAnchor = new Map(movements.map(row => [row.anchor, row]))
  return (
    <section id="patterns" className="bw-section bw-patterns" aria-labelledby="patterns-title">
      <div className="ml-container">
        <Heading eyebrow="OBSERVED PATTERN" id="patterns-title" title="여러 움직임에서 나타난 방향" deck="서로 다른 둘 이상의 움직임에서 반복적으로 관찰된 방향입니다. 해석이 아니라 관찰입니다." />
        {patterns.length ? (
          <div className="bw-pattern-list">
            {patterns.map((pattern, patternIndex) => {
              const supporting = pattern.movementAnchors.map(row => ({ row, movement: byAnchor.get(row.anchor) }))
              // Themes every supporting move already carries; nothing new is written.
              const shared = supporting.every(entry => entry.movement) ? supporting[0].movement!.themes.filter(theme => supporting.every(entry => entry.movement!.themes.some(row => row.slug === theme.slug))) : []
              return (
                <article key={pattern.id} id={pattern.anchor} className={`bw-pattern bw-reveal bw-pattern-n${Math.min(supporting.length, 4)}`} aria-labelledby={`${pattern.anchor}-title`} style={{ "--bw-n": supporting.length } as CSSProperties}>
                  <p className="bw-pattern-top"><span className="bw-label bw-label-pattern">OBSERVED PATTERN</span><span className="bw-pattern-number">{pad(patternIndex + 1)}</span><span className="bw-window"><time dateTime={pattern.windowStart}>{formatDay(pattern.windowStart)}</time> – <time dateTime={pattern.windowEnd}>{formatDay(pattern.windowEnd)}</time></span></p>
                  <ol className="bw-reveal-evidence" aria-label={`근거가 된 움직임 ${supporting.length}건`}>
                    {supporting.map(({ row, movement }, index) => (
                      <li key={row.anchor} style={{ "--bw-i": index } as CSSProperties}>
                        <span className={`bw-reveal-frame${movement?.visual ? "" : " bw-reveal-frame-empty"}`}>
                          {movement?.visual ? <EvidenceImage visual={movement.visual} width={640} /> : <span className="bw-reveal-plate">{movement ? typeLabel(movement) : "FACT"}</span>}
                          <span className="bw-reveal-index" aria-hidden="true">{pad(index + 1)}</span>
                        </span>
                        <span className="bw-reveal-move">
                          <a href={`#${row.anchor}`}>{keepDots(row.title)}</a>
                          {movement ? <span className="bw-reveal-move-meta">{typeLabel(movement)}{movement.date ? <> · {formatPublicDate(movement.date)}</> : null}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="bw-reveal-bracket" aria-hidden="true"><span /></div>
                  <div className="bw-reveal-pattern">
                    {shared.length ? <p className="bw-reveal-common"><span>공통 테마</span>{shared.map(theme => <span key={theme.slug}>{theme.name}</span>)}</p> : null}
                    <h3 id={`${pattern.anchor}-title`}>{keepDots(pattern.title)}</h3>
                    <p className="bw-pattern-text">{keepDots(pattern.description)}</p>
                    {pattern.asOfOnly ? <p className="bw-asof-note">관찰 기간이 지난 패턴입니다 · {formatDay(pattern.windowEnd)} 기준</p> : null}
                    <Refs refs={pattern.sourceRefs} />
                  </div>
                </article>
              )
            })}
          </div>
        ) : <p className="bw-empty">아직 공개된 Observed Pattern이 없습니다.</p>}
      </div>
    </section>
  )
}

// The Pattern's stem continues into the dark section: one transition marker, then the interpretation.
function TakesSection({ takes }: { takes: PublicTake[] }) {
  return (
    <section id="take" className="bw-section bw-takes" aria-labelledby="take-title">
      <div className="ml-container">
        <p className="bw-handoff"><span className="bw-handoff-stem" aria-hidden="true" /><span className="bw-handoff-label">From pattern to interpretation</span></p>
        <div className="bw-take-heading">
          <p className="ml-eyebrow"><span className="bw-label bw-label-take">MARKLENS TAKE</span></p>
          <h2 id="take-title">MarkLens의 해석<span className="ml-blue">.</span></h2>
          <p className="bw-deck">아래 내용은 사실(FACT)이 아니라, 위의 Observed Pattern을 바탕으로 한 MarkLens의 해석입니다.</p>
        </div>
        {takes.length ? takes.map((take, index) => (
          <article key={take.id} id={take.anchor} className="bw-take" aria-label={`MarkLens Take: ${take.pattern.title}`}>
            <p className="bw-take-top">
              <span className="bw-take-number">{pad(index + 1)}</span>
              <span className="bw-take-from-label">Based on Observed Pattern {pad(Number(take.pattern.anchor.replace("pattern-", "")))}</span>
              <a href={`#${take.pattern.anchor}`}>{keepDots(take.pattern.title)}</a>
            </p>
            {take.asOfOnly ? <p className="bw-asof-note">기반 패턴의 관찰 기간이 지난 해석입니다.</p> : null}
            <dl>
              <div className="bw-take-why"><dt>WHY IT MAY MATTER</dt><dd>{keepDots(take.whyItMayMatter)}</dd></div>
              <div className="bw-take-see"><dt>WHAT WE SEE</dt><dd>{keepDots(take.whatWeSee)}</dd></div>
              <div className="bw-take-watch"><dt>WHAT TO WATCH NEXT</dt><dd>{keepDots(take.whatToWatchNext)}</dd></div>
            </dl>
            <Refs refs={take.sourceRefs} label="해석의 근거 출처" />
          </article>
        )) : <p className="bw-empty">아직 공개된 MarkLens Take가 없습니다.</p>}
      </div>
    </section>
  )
}

// Three or fewer Movements were all just shown above, so the timeline is a compact archive (date, FACT/type,
// headline, sources, confirmed facts); larger timelines keep summaries and picture only what was not shown above.
function TimelineSection({ movements, themes, pictured }: { movements: PublicMovement[]; themes: Available["themes"]; pictured: Set<string> }) {
  const compact = movements.length <= 3
  return (
    <section id="moves" className="bw-section bw-moves" aria-labelledby="moves-title">
      <div className="ml-container">
        <div className="bw-timeline-heading">
          <Heading eyebrow="FACT · TIMELINE" id="moves-title" title="확인된 움직임 전체" deck="같은 사건을 다룬 여러 보도는 하나의 움직임으로 묶었습니다." />
          {themes.length ? <p className="bw-themes"><span>Themes</span>{themes.map(theme => <span key={theme.slug}>{theme.name}</span>)}</p> : null}
        </div>
        {movements.length ? (
          <ol className={`bw-move-list${compact ? " bw-move-list-compact" : ""}`}>
            {movements.map(movement => {
              const thumb = !compact && movement.visual && !pictured.has(movement.id) ? movement.visual : null
              return (
              <li key={movement.id} id={movement.anchor} className={`bw-move${thumb ? " bw-move-has-visual" : ""}`}>
                <DateLabel date={movement.date} />
                {thumb ? <span className="bw-move-thumb"><EvidenceImage visual={thumb} width={480} /></span> : null}
                <div className="bw-move-body">
                  <p className="bw-move-kind"><span className="bw-label bw-label-fact">FACT</span><span>{typeLabel(movement)}</span>{movement.themes.map(theme => <span key={theme.slug} className="bw-move-theme">{theme.name}</span>)}</p>
                  <h3>{keepDots(movement.title)}</h3>
                  {compact ? null : <p className="bw-move-summary">{keepDots(movement.summary)}</p>}
                  <Refs refs={movement.sourceRefs} label={`출처 ${movement.sourceRefs.length}건${movement.providerCount > 1 ? ` · 매체 ${movement.providerCount}곳` : ""}`} />
                  <details className="bw-evidence"><summary>확인된 사실 {movement.facts.length}건 보기</summary>
                    <ul>{movement.facts.map(fact => <li key={fact.id}><p>{keepDots(fact.fact)}</p><p className="bw-evidence-meta">{fact.date ? <DateLabel date={fact.date} /> : null}{fact.sourceRef ? <a href={`#source-${fact.sourceRef}`} aria-label={`출처 ${fact.sourceRef}번으로 이동`}>[{fact.sourceRef}]</a> : null}</p></li>)}</ul>
                  </details>
                </div>
              </li>
              )
            })}
          </ol>
        ) : <p className="bw-empty">아직 공개된 움직임이 없습니다.</p>}
      </div>
    </section>
  )
}

function SourcesSection({ sources, imageRefs }: { sources: PublicSource[]; imageRefs: Set<number> }) {
  return (
    <section id="sources" className="bw-section bw-sources" aria-labelledby="sources-title">
      <div className="ml-container">
        <Heading eyebrow="SOURCES" id="sources-title" title="출처" deck="원문을 옮기지 않고 제목과 링크만 표시합니다. 이미지는 각 원문 페이지에 게재된 것을 저장하지 않고 연결해 보여줍니다." />
        {sources.length ? (
          <ol className="bw-source-list">
            {sources.map(source => (
              <li key={source.ref} id={`source-${source.ref}`}>
                <span className="bw-source-ref" aria-hidden="true">[{source.ref}]</span>
                <div>
                  <p className="bw-source-meta"><span>{source.provider}</span><span>{PROVIDER_TYPE_LABELS[source.providerType] ?? "매체"}</span>{source.publishedAt ? <time dateTime={isoDay(source.publishedAt)}>{formatDay(source.publishedAt)}</time> : null}{imageRefs.has(source.ref) ? <span className="bw-source-image">이미지 게재</span> : null}</p>
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
