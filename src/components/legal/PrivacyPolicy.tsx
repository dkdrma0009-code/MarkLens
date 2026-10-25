import type { PrivacyFacts } from "@/lib/legal/privacy"

// 개인정보처리방침 본문(R-4). 처리 항목은 코드에서 확인한 실제 흐름이고, 운영자 확정 항목은 facts에서 온다.
// /privacy 는 facts가 모두 확정됐을 때만 이 본문을 그린다(src/app/(public)/privacy/page.tsx). 최종 문안은 운영자·법률 검토 대상.
export default function PrivacyPolicy({ facts }: { facts: PrivacyFacts }) {
  const r = facts.retention
  const rows: [string, string, string, string][] = [
    ["뉴스레터(Weekly)", "이메일 주소, 구독 경로(페이지 위치), 구독·확인·해지 시각", "구독 확인과 뉴스레터·온보딩 메일 발송", `${r.subscribers}. 해지하면 발송이 바로 멈춥니다.`],
    ["Insight Lab 로그인", "이메일 주소(로그인 계정), 분석 답변·노트·학습 기록", "로그인, 기록 저장, 성장 리포트", `${r.members}. 계정이 삭제되면 기록도 함께 삭제됩니다.`],
    ["AI 기능(챗·면접 연습·학습·Insight Lab)", "사용자가 입력한 문장", "답변·피드백 생성. Insight Lab 답변 외에는 저장하지 않습니다.", "Insight Lab 답변은 위 회원 기록과 같습니다."],
    ["AI 사용량 제한", "접속 IP의 해시값(원문 IP는 저장하지 않음), 로그인 회원 식별자", "과도한 사용 방지", `${r.aiUsage}`],
    ["의견 보내기", "평가, 남긴 의견(이름·연락처 없음)", "서비스 개선. 인사이트 의견은 운영자에게 메일로 전달됩니다.", `${r.feedback}`],
    ["방문 통계(Google Analytics 4)", "쿠키, 기기·브라우저 정보, 방문 페이지", "이용 통계", "Google 정책과 설정 기간"],
  ]
  return (
    <div className="ml-pages ml-privacy">
      <header className="ml-page-hero">
        <div className="ml-container">
          <p className="ml-eyebrow">MARKLENS / PRIVACY</p>
          <h1>개인정보처리방침</h1>
          <p className="ml-page-intro">{facts.operator}(이하 &quot;MarkLens&quot;)는 아래와 같이 개인정보를 처리합니다. 시행일: {facts.effectiveDate}</p>
        </div>
      </header>
      <div className="ml-container">
        <section className="ml-page-section" aria-labelledby="privacy-items">
          <h2 id="privacy-items">1. 처리하는 개인정보와 목적, 보유 기간</h2>
          <table className="ml-privacy-table">
            <thead><tr><th scope="col">서비스</th><th scope="col">항목</th><th scope="col">목적</th><th scope="col">보유 기간</th></tr></thead>
            <tbody>{rows.map(([service, items, purpose, keep]) => <tr key={service}><th scope="row">{service}</th><td>{items}</td><td>{purpose}</td><td>{keep}</td></tr>)}</tbody>
          </table>
          <p>보유 기간이 지난 기록은 다음 절차로 파기합니다: {facts.disposalProcess}</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-refuse">
          <h2 id="privacy-refuse">2. 동의를 거부할 권리</h2>
          <p>개인정보 제공을 거부할 수 있습니다. 거부하면 뉴스레터 수신이나 Insight Lab 기록 저장을 이용할 수 없으며, 사이트 열람은 그대로 가능합니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-processors">
          <h2 id="privacy-processors">3. 처리 위탁과 국외 이전</h2>
          <ul>
            <li>Supabase — 데이터베이스·로그인 ({facts.databaseRegion})</li>
            <li>Vercel — 웹 호스팅(미국 등)</li>
            <li>Brevo — 메일 발송(EU)</li>
            <li>Google — 방문 통계(Analytics), AI 응답 생성(Gemini)(미국)</li>
            <li>Anthropic, OpenAI — AI 응답 생성 대체 경로(미국)</li>
          </ul>
          <p>제3자에게 개인정보를 제공하지 않습니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">4. 정보주체의 권리와 행사 방법</h2>
          <p>열람·정정·삭제·처리정지를 요청할 수 있습니다. 뉴스레터는 메일 하단의 구독 해지 링크로 바로 해지할 수 있고, 기록 삭제와 그 밖의 요청은 {facts.contactEmail} 로 보내 주세요.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-cookies">
          <h2 id="privacy-cookies">5. 쿠키</h2>
          <p>방문 통계를 위해 Google Analytics 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 거부할 수 있습니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-safety">
          <h2 id="privacy-safety">6. 안전성 확보 조치</h2>
          <p>전송 구간 암호화(HTTPS), 데이터베이스 접근 권한 분리(행 단위 보안), 관리자 인증, 구독 이중 확인, 원문 IP 미저장.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-officer">
          <h2 id="privacy-officer">7. 개인정보 보호책임자</h2>
          <p>{facts.privacyOfficer} · {facts.contactEmail}</p>
          <p>운영 주체: {facts.operator} · 대표자: {facts.representative}</p>
        </section>
      </div>
    </div>
  )
}
