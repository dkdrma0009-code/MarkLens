import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import InsightActions from "@/app/admin/insights/InsightActions"
import { getGa4Overview } from "@/lib/ga4"
import { getInstagramInsights } from "@/lib/instagram"
import { getThreadsInsights } from "@/lib/threads"
import { ContentError } from "@/components/admin-v2/ContentQueue"
import { socialDate } from "@/components/admin-v2/social/types"
import ObservationChart from "./ObservationChart"

export const dynamic = "force-dynamic"
interface Insight { id: string; slug: string; hook: string | null; category: string | null; view_count: number | null; article: { title: string | null; status: string } | null }
const number = (value: number | null | undefined) => value == null ? "미수집" : value.toLocaleString()
export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin()
  const params = await searchParams
  const days = ["7", "30", "90"].includes(params.days || "") ? Number(params.days) : 30
  const queriedAt = new Date()
  const since = new Date(queriedAt.getTime() - days * 86400 * 1000).toISOString()
  const db = createAdminClient()
  const [articleCount, publishedCount, insightCount, subscriberCount, sentCount, insights, feedback, igSnapshots, thSnapshots, newSubs, unsubs, metrics, issues, ga4, ig, threads] = await Promise.all([
    db.from("articles").select("*", { count: "exact", head: true }),
    db.from("articles").select("*", { count: "exact", head: true }).eq("status", "published"),
    db.from("insights").select("*", { count: "exact", head: true }),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "active"),
    db.from("newsletter_issues").select("*", { count: "exact", head: true }).eq("status", "sent"),
    db.from("insights").select("id,slug,hook,category,view_count,article:articles!inner(title,status)").eq("article.status", "published").order("view_count", { ascending: false, nullsFirst: false }).limit(100),
    db.from("feedback").select("insight_id,rating").limit(1000),
    db.from("follower_snapshots").select("followers,recorded_at").eq("platform", "instagram").gte("recorded_at", since).order("recorded_at").limit(1000),
    db.from("follower_snapshots").select("followers,recorded_at").eq("platform", "threads").gte("recorded_at", since).order("recorded_at").limit(1000),
    db.from("subscribers").select("subscribed_at", { count: "exact", head: true }).gte("subscribed_at", since),
    db.from("subscribers").select("unsubscribed_at", { count: "exact", head: true }).not("unsubscribed_at", "is", null).gte("unsubscribed_at", since),
    db.from("content_metrics").select("id,content_type,content_id,platform,reach,likes,saved,shares,comments,followers_at_time,posted_at,recorded_at").order("recorded_at", { ascending: false }).limit(100),
    db.from("newsletter_issues").select("id,issue_number,title,sent_at").eq("status", "sent").order("issue_number", { ascending: false }).limit(8),
    getGa4Overview(), getInstagramInsights(), getThreadsInsights(),
  ])
  const events = issues.error || !issues.data?.length ? null : await db.from("newsletter_events").select("issue_id,email,event", { count: "exact" }).in("issue_id", issues.data.map(row => row.id)).limit(1000)
  const gaObserved = !!ga4 && (!!ga4.daily.length || !!ga4.sources.length || !!ga4.pages.length || !!ga4.devices.length || Object.values(ga4.summary).some(value => value > 0))
  const rows = (insights.data || []) as unknown as Insight[]
  const measured = rows.filter(row => row.view_count !== null)
  const sum = measured.reduce((total, row) => total + (row.view_count || 0), 0)
  const helpful: Record<string, number> = {}
  for (const row of feedback.data || []) if (row.rating === "helpful") helpful[row.insight_id] = (helpful[row.insight_id] || 0) + 1
  const categories = [...new Set(rows.map(row => row.category || "기록 없음"))].map(category => {
    const group = rows.filter(row => (row.category || "기록 없음") === category)
    const values = group.filter(row => row.view_count !== null)
    const views = values.reduce((total, row) => total + (row.view_count || 0), 0)
    return { category, count: group.length, measured: values.length, views, average: values.length ? views / values.length : null }
  }).sort((a, b) => (b.average ?? -1) - (a.average ?? -1))
  const counts = [
    ["전체 Article", articleCount], ["Published Article", publishedCount], ["전체 Insight", insightCount],
    ["활성 구독자", subscriberCount], ["DB sent 호", sentCount],
  ] as const
  return <div className="ops-workspace intelligence-workspace"><div className="social-page-heading"><div><p>PERFORMANCE INTELLIGENCE</p><h2>Observe. Compare. Understand.</h2><span>화면 조회 {socialDate(queriedAt.toISOString())} · 원천 수집 시각과 다릅니다.</span></div></div>
    <div className="intelligence-scope"><nav className="social-views" aria-label="DB 관측 기간">{[7, 30, 90].map(value => <Link key={value} aria-current={days === value ? "page" : undefined} href={`/admin/analytics?days=${value}`}>{value}일</Link>)}</nav><p>기간 필터: DB follower 관측·구독/취소 timestamp만 적용<br /><small>{socialDate(since)} — {socialDate(queriedAt.toISOString())}</small></p></div>
    <div className="intelligence-inventory">{counts.map(([label, result]) => <div key={label}><span>{label}</span><strong>{result.error ? "조회 실패" : number(result.count)}</strong></div>)}</div>
    <section className="intelligence-section" aria-label="Audience and traffic"><div className="ops-panel-heading"><div><p>AUDIENCE / TRAFFIC</p><h3>Actual observations</h3></div></div><p className="admin-note">선택 기간 신규 구독 timestamp {newSubs.error ? "조회 실패" : number(newSubs.count)}건 · 취소 timestamp {unsubs.error ? "조회 실패" : number(unsubs.count)}건. 가입 timestamp는 인증 완료 수가 아니며, 과거 구독자 전체 이력을 보장하지 않습니다.</p>
      {!ga4 ? <p className="social-notice" role="status">GA4 조회 불가 · 미설정과 조회 실패를 기존 getter가 구분하지 않습니다. 0명으로 표시하지 않습니다.</p> : <><div className="intelligence-inline-metrics">{Object.entries(ga4.summary).map(([label, value]) => <span key={label}>{label} <strong>{gaObserved ? number(value) : "관측값 확인 불가"}</strong></span>)}</div><p className="admin-note">GA4 API 고정 기간: 28daysAgo — today, GA4 property 시간대. activeUsers는 활성 사용자이며 daily 값 합계로 기간 사용자를 계산하지 않습니다. 원천 수집 시각은 제공되지 않습니다. 기존 getter의 summary 누락→0 폴백은 전체 관측이 없을 때 표시하지 않습니다.</p><ObservationChart title="GA4 daily active users" unit="users" points={ga4.daily.map(row => ({ date: row.date.length === 8 ? `${row.date.slice(0, 4)}-${row.date.slice(4, 6)}-${row.date.slice(6, 8)}` : row.date, value: row.users ?? null }))} /><div className="intelligence-breakdowns"><div><h4>GA4 Sources · sessions / 최대 8</h4>{ga4.sources.length ? ga4.sources.map(row => <p key={row.source}><span>{row.source || "원천 label 없음"}</span><strong>{number(row.sessions)}</strong></p>) : <p>관측값 없음</p>}</div><div><h4>GA4 Pages · views / 최대 10</h4>{ga4.pages.length ? ga4.pages.map(row => <p key={row.path}><span>{row.path}</span><strong>{number(row.views)}</strong></p>) : <p>관측값 없음</p>}</div><div><h4>GA4 Devices · sessions</h4>{ga4.devices.map(row => <p key={row.device}><span>{row.device}</span><strong>{number(row.sessions)}</strong></p>)}</div></div></>}
      <div className="intelligence-chart-pair">{[{ title: "Instagram follower snapshots", result: igSnapshots }, { title: "Threads follower snapshots", result: thSnapshots }].map(({ title, result }) => <div key={title}>{result.error ? <><h3>{title}</h3><ContentError /></> : <ObservationChart title={title} unit="followers" points={(result.data || []).map(row => ({ date: row.recorded_at, value: row.followers ?? null }))} />}<p className="admin-note">선택 {days}일 · recorded_at 관측 시각 · 최대 1,000행 · 성장률 계산 없음</p></div>)}</div>
    </section>
    <section className="intelligence-section" aria-label="Content performance"><div className="ops-panel-heading"><div><p>CONTENT / CUMULATIVE COUNTERS</p><h3>Ranked insights · Top 100 scope</h3></div></div>{insights.error ? <ContentError /> : <><p className="intelligence-total">조회 상위 최대 100개 합계 <strong>{sum.toLocaleString()}</strong></p><p className="admin-note">Published Article 연결 Insight {rows.length}개 불러옴 · view_count 있는 {measured.length}개 합계 · 누적값, 선택 기간과 무관. 전체 DB 조회수 아님. counter 수집 시각은 제공되지 않습니다.</p>{feedback.error && <p className="social-notice">Helpful feedback 조회 실패 · 좋아요를 0으로 표시하지 않습니다.</p>}{!rows.length ? <p className="admin-empty">조회된 published Insight가 없습니다.</p> : <div className="admin-content-table-wrap"><table className="admin-content-table intelligence-table"><caption className="sr-only">Top 100 cumulative insight performance</caption><thead><tr>{["Rank / Content", "Category", "Stored view_count", "Helpful records", "Actions"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td data-label="Content"><small>{String(index + 1).padStart(2, "0")}</small><h3><Link target="_blank" rel="noopener noreferrer" href={`/insights/${row.slug}`}>{row.hook || row.article?.title || "제목 없음"}</Link></h3></td><td data-label="Category">{row.category || "기록 없음"}</td><td data-label="view_count">{number(row.view_count)}</td><td data-label="Helpful">{feedback.error ? "조회 실패" : helpful[row.id] || 0}</td><td data-label="Actions"><InsightActions insightId={row.id} title={row.hook || row.article?.title || "Insight"} /></td></tr>)}</tbody></table></div>}<p className="admin-note">Helpful = 실제 rating=helpful 응답 집계, 최대 1,000 feedback 행 범위. 별도 만족도 점수 아님.</p>{categories.length > 0 && <details className="intelligence-details"><summary>상위 100개 내 category 집계</summary>{categories.map(row => <p key={row.category}>{row.category} · {row.count}개 · 측정 {row.measured}개 · 평균 {row.average === null ? "미수집" : row.average.toFixed(1)} · 합계 {row.views}</p>)}</details>}</>}
    </section>
    <section className="intelligence-section" aria-label="Social latest metrics"><div className="ops-panel-heading"><div><p>SOCIAL / LATEST SNAPSHOTS</p><h3>Stored post metrics</h3></div></div><p className="admin-note">content_metrics는 게시물별 upsert 최신 snapshot입니다. 최대 최근 100행, 선택 기간과 무관. 조회 실패가 0으로 저장될 수 있어 저장값 0과 측정된 실제 0을 이 계약으로 구분할 수 없습니다. Threads 발행 성공을 추론하지 않습니다.</p>{metrics.error ? <ContentError /> : !metrics.data?.length ? <p className="admin-empty">저장된 social metric snapshot이 없습니다.</p> : <div className="admin-content-table-wrap"><table className="admin-content-table intelligence-table"><caption className="sr-only">Latest stored social metric snapshots</caption><thead><tr>{["Content / Platform", "Reach / Likes", "Saved / Shares / Comments", "Followers at time", "Recorded / KST"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{metrics.data.map(row => <tr key={row.id}><td data-label="Content / Platform"><h3>{row.content_type} / {row.platform}</h3><small>{row.content_id}</small></td><td data-label="Reach / Likes">{number(row.reach)} / {number(row.likes)}</td><td data-label="Saved / Shares / Comments">{number(row.saved)} / {number(row.shares)} / {number(row.comments)}</td><td data-label="Followers">{number(row.followers_at_time)}</td><td data-label="Recorded">{socialDate(row.recorded_at)}<small>게시 timestamp {socialDate(row.posted_at)}</small></td></tr>)}</tbody></table></div>}
      <details className="intelligence-details"><summary>기존 플랫폼 API 조회 결과</summary><p className="admin-note">API 현재 응답입니다. 개별 지표 실패는 기존 getter가 0으로 반환할 수 있습니다. 원천 수집 시각은 별도 제공되지 않습니다.</p>{!ig ? <p>Instagram 조회 불가 · 미연동/오류 구분 불가</p> : <><p>Instagram @{ig.account.username} · followers {ig.account.followers} · media {ig.account.mediaCount}</p><p className="admin-note">Instagram API daily reach · 원천 getter는 연도 없는 MM-DD만 제공합니다.</p>{ig.dailyReach.map((row, index) => <p key={index}>{row.date || "날짜 기록 없음"} · reach {row.reach}</p>)}{ig.media.map(row => <p key={row.id}><a href={row.permalink} target="_blank" rel="noopener noreferrer">{row.caption || "캡션 없음"}</a> · {socialDate(row.timestamp)} · {row.mediaType} · reach {row.reach}, likes {row.likes}, saved {row.saved}, shares {row.shares}, comments {row.comments}</p>)}</>}{!threads ? <p>Threads 조회 불가 · 미연동/오류 구분 불가</p> : <><p>Threads @{threads.account.username} · followers {threads.account.followers} · 조회한 게시물 views 합계 {threads.totalViews}</p>{threads.media.map(row => <p key={row.id}><a href={row.permalink} target="_blank" rel="noopener noreferrer">{row.text || "내용 없음"}</a> · {socialDate(row.timestamp)} · views {row.views}, likes {row.likes}, replies {row.replies}, reposts {row.reposts}, quotes {row.quotes}</p>)}</>}</details>
    </section>
    <section className="intelligence-section" aria-label="Newsletter events"><div className="ops-panel-heading"><div><p>NEWSLETTER / BREVO EVENTS</p><h3>Observed email events</h3></div></div><p className="admin-note">최근 DB sent 8개 호 · 이벤트 최대 1,000행 · email별 고유 이벤트 집계. DB sent ≠ delivered. 원천 이벤트 수집 시각은 이 조회에서 제공되지 않습니다.</p>{issues.error || events?.error ? <ContentError /> : !issues.data?.length ? <p className="admin-empty">DB sent Newsletter가 없습니다.</p> : <div className="admin-content-table-wrap"><table className="admin-content-table intelligence-table"><caption className="sr-only">Brevo unique events by recent newsletter issue</caption><thead><tr>{["Issue / DB sent", "Delivered records", "Open / Click records", "Open rate / Click rate"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{issues.data.map(issue => {
      const own = (events?.data || []).filter(event => event.issue_id === issue.id)
      const count = (names: string[]) => new Set(own.filter(event => names.includes(event.event)).map(event => event.email)).size
      const delivered = count(["delivered"]), opens = count(["opened", "unique_opened"]), clicks = count(["click", "clicks"])
      return <tr key={issue.id}><td data-label="Issue"><h3>#{issue.issue_number} {issue.title}</h3><small>{socialDate(issue.sent_at)}</small></td><td data-label="Delivered records">{own.length ? delivered : "이벤트 미수집"}</td><td data-label="Open / Click">{own.length ? `${opens} / ${clicks}` : "이벤트 미수집"}</td><td data-label="Open rate / Click rate">{events?.count != null && events.count > (events.data?.length || 0) ? "조회 제한 · 비율 계산 생략" : delivered ? `${Math.round(opens / delivered * 100)}% / ${Math.round(clicks / delivered * 100)}%` : "전달 분모 없음 · 계산 불가"}</td></tr>
    })}</tbody></table></div>}<p className="admin-note">오픈율 = 고유 opened/unique_opened ÷ 고유 delivered. 클릭율 = 고유 click/clicks ÷ 고유 delivered. delivered가 없으면 opens를 대체 분모로 사용하지 않습니다. 발송 대비 delivery rate는 계산하지 않습니다.</p></section>
  </div>
}
