import Link from "next/link"
import { ArrowRight } from "lucide-react"
import HealthPanel from "@/components/admin/HealthPanel"
import TokenStatusPanel from "@/components/admin/TokenStatusPanel"
import DailyChecklist from "@/components/admin/DailyChecklist"
import type { getOperationsOverview, ReadResult } from "./overview-data"

type Overview = Awaited<ReturnType<typeof getOperationsOverview>>

function ErrorState() {
  return <span className="admin-data-error" role="status">데이터를 불러오지 못했습니다.</span>
}

function Count({ result }: { result: ReadResult<number> }) {
  return result.ok ? <strong>{result.value.toLocaleString("ko-KR")}<small>건</small></strong> : <ErrorState />
}

function Section({ label, title, children, link }: {
  label: string; title: string; children: React.ReactNode; link?: { href: string; text: string }
}) {
  return <section className="admin-section">
    <div className="admin-section-heading"><div><p>{label}</p><h2>{title}</h2></div>
      {link && <Link href={link.href}>{link.text}<ArrowRight size={15} aria-hidden="true" /></Link>}
    </div>{children}
  </section>
}

function timestamp(value: string | null) {
  return value ? new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value)) + " KST" : "시각 기록 없음"
}

export default function OperationsOverview({ data: d }: { data: Overview }) {
  const attention = [
    { label: "수집 기사 검수", note: "Pending · 분석 전 검토할 현재 기사", result: d.pending, href: "/admin/articles" },
    { label: "분석 완료 기사 확인", note: "Ready · 사이트 발행 전 검토", result: d.ready, href: "/admin/articles" },
    { label: "이미지 없는 콘텐츠", note: "Ready / Published · 원본·fallback URL 모두 없음", result: d.missingImages, href: "/admin/insights" },
    { label: "뉴스레터 승인 대기", note: "Draft · 승인 기록 없는 초안", result: d.drafts, href: "/admin/newsletter" },
    { label: "예약 시각 지난 Social", note: "미게시 상태 · 원인 확인 필요, 실패 확정 아님", result: d.overdue, href: "/admin/cardnews" },
  ]
  const visibleAttention = attention.filter(item => !item.result.ok || item.result.value > 0)
  const stages = [
    { label: "Pending", note: "검수 대기", result: d.pending, href: "/admin/articles", tone: "warning" },
    { label: "Analyzing", note: "분석 상태", result: d.analyzing, href: "/admin/articles", tone: "neutral" },
    { label: "Ready", note: "분석 완료", result: d.ready, href: "/admin/articles", tone: "blue" },
    { label: "Published", note: "공개 상태", result: d.published, href: "/admin/insights", tone: "success" },
  ]

  return <div className="admin-overview">
    <div className="admin-overview-intro"><p>EDITORIAL INTELLIGENCE CONTROL ROOM</p>
      <span>{d.day.replaceAll("-", ".")} / KST</span></div>
    <div className="admin-snapshot" aria-label="운영 요약">
      {[
        { label: "Today collected", note: "오늘 수집 · 용어 카드 제외", result: d.collected },
        { label: "Today new insights", note: "오늘 신규 생성 · 재분석 제외", result: d.insights },
        { label: "Current ready", note: "현재 분석 완료 재고", result: d.ready },
        { label: "Today site published", note: "자동 사이트 발행 기록만", result: d.sitePublished },
      ].map(item => <div key={item.label}><p>{item.label}</p><Count result={item.result} /><span>{item.note}</span></div>)}
    </div>

    <Section label="Needs attention" title="지금 확인할 항목" link={{ href: "/admin/articles", text: "콘텐츠 확인" }}>
      {visibleAttention.length ? <div className="admin-attention">
        {visibleAttention.map(item => <Link href={item.href} key={item.label}>
          <div><h3><i className={item.result.ok ? "warning" : "error"} aria-hidden="true" />{item.label}</h3><p>{item.note}</p></div>
          <div className="admin-attention-value"><Count result={item.result} /><ArrowRight size={17} aria-hidden="true" /></div>
        </Link>)}
      </div> : <p className="admin-empty">현재 조회한 검수·승인·지연 항목은 없습니다. 전체 시스템 정상 여부는 아래 연동 상태에서 확인하세요.</p>}
    </Section>

    <Section label="Content pipeline" title="현재 콘텐츠 재고">
      <div className="admin-pipeline">{stages.map(stage => <Link key={stage.label} href={stage.href}>
        <p><i className={stage.tone} aria-hidden="true" />{stage.label}<ArrowRight size={14} aria-hidden="true" /></p>
        <Count result={stage.result} /><span>{stage.note}</span>
      </Link>)}</div>
      <p className="admin-note">현재 상태별 기사 수입니다. 오늘 이동량이나 분석 성공·실패 수가 아닙니다.</p>
    </Section>

    <Section label="Distribution" title="배포 확인">
      <div className="admin-distribution">
        <div><div className="admin-module-heading"><h3>Social</h3><Link href="/admin/cardnews">운영 화면 <ArrowRight size={14} aria-hidden="true" /></Link></div>
          <dl>
            <div><dt>미게시 카드 <small>skipped_stale 제외</small></dt><dd><Count result={d.socialPending} /></dd></div>
            <div><dt>다음 예약</dt><dd>{!d.upcoming.ok ? <ErrorState /> : d.upcoming.value[0] ? timestamp(d.upcoming.value[0].scheduled_at) : "예정된 예약 없음"}</dd></div>
            <div><dt>최근 게시 기록</dt><dd>{!d.latestPosted.ok ? <ErrorState /> : d.latestPosted.value[0] ? timestamp(d.latestPosted.value[0].posted_at) : "게시 기록 없음"}</dd></div>
          </dl><p className="admin-note">posted_at 기록 기준. Instagram·Threads 양쪽 성공을 보장하지 않습니다.</p>
        </div>
        <div><div className="admin-module-heading"><h3>Newsletter</h3><Link href="/admin/newsletter">운영 화면 <ArrowRight size={14} aria-hidden="true" /></Link></div>
          <dl>
            <div><dt>최근 초안</dt><dd>{!d.latestDraft.ok ? <ErrorState /> : d.latestDraft.value[0] ? `#${d.latestDraft.value[0].issue_number} · ${d.latestDraft.value[0].approved_at ? "승인 기록 있음" : "승인 대기"}` : "초안 없음"}</dd></div>
            <div><dt>최근 발송 호수</dt><dd>{!d.latestSent.ok ? <ErrorState /> : d.latestSent.value[0] ? `#${d.latestSent.value[0].issue_number}` : "발송 기록 없음"}</dd></div>
            <div><dt>발송 기록 시각</dt><dd>{!d.latestSent.ok ? <ErrorState /> : d.latestSent.value[0] ? timestamp(d.latestSent.value[0].sent_at) : "발송 기록 없음"}</dd></div>
          </dl><p className="admin-note">sent 상태 기준. 모든 수신자에게 전달됐다는 의미는 아닙니다.</p>
        </div>
      </div>
    </Section>

    <div className="admin-performance-link"><div><span>PERFORMANCE</span><p>기간과 출처를 확인한 성과 분석</p></div>
      <Link href="/admin/analytics">Analytics <ArrowRight size={16} aria-hidden="true" /></Link></div>

    <Section label="System health" title="연동 및 운영 점검">
      <div className="admin-system"><HealthPanel /><TokenStatusPanel /></div>
      <details className="admin-checklist"><summary>수동 운영 체크리스트</summary><DailyChecklist /></details>
    </Section>
  </div>
}
