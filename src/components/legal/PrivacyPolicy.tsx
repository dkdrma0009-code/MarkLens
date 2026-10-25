import type { PrivacyFacts } from "@/lib/legal/privacy"

// 개인정보처리방침 본문(R-4). 처리 항목은 코드에서 확인한 실제 흐름이고, 운영자 확정 항목은 facts에서 온다.
// /privacy 는 facts가 모두 확정됐을 때만 이 본문을 그린다(src/app/(public)/privacy/page.tsx). 최종 문안은 운영자·법률 검토 대상.
export default function PrivacyPolicy({ facts }: { facts: PrivacyFacts }) {
  const r = facts.retention
  const rows: [string, string, string, string][] = [
    ["뉴스레터(Weekly)", "이메일 주소, 구독 경로(페이지 위치), 구독·확인 시각", "구독 확인과 뉴스레터·온보딩 메일 발송", `${r.subscribers}`],
    ["뉴스레터 발송 기록", "이메일 주소, 메일별 발송·열람·클릭 여부와 시각", "발송 결과 확인", `${r.newsletterEvents}. 구독을 해지하면 즉시 삭제`],
    ["Insight Lab 로그인", "이메일 주소(로그인 계정), 분석 답변·노트·학습 기록", "로그인, 기록 저장, 성장 리포트", `${r.members}`],
    ["AI 기능(챗·면접 연습·학습·Insight Lab)", "사용자가 입력한 문장", "답변·피드백 생성. Insight Lab 답변 외에는 저장하지 않습니다.", "Insight Lab 답변은 위 회원 기록과 같습니다."],
    ["AI 사용량 제한", "접속 IP의 해시값(원문 IP는 저장하지 않음), 로그인 회원 식별자", "과도한 사용 방지", `${r.aiUsage}`],
    ["의견 보내기", "평가, 남긴 의견(이름·연락처 없음)", "서비스 개선. 인사이트 의견은 운영자에게 메일로 전달됩니다.", `${r.feedback}`],
    ["개인정보 문의(메일)", "보낸 사람 이메일 주소, 문의 내용", "문의 답변, 열람·삭제 등 권리 행사 처리", `${r.inquiries}`],
    ["방문 통계(Google Analytics 4)", "쿠키, 기기·브라우저 정보, 방문 페이지", "이용 통계", "Google의 설정 기간"],
  ]
  // 업체·위치·연락처는 코드·설정·각 사 공식 개인정보 문서에서 확인했다(2026-10-25). 국외 이전 고지 항목(법 제28조의8 제2항):
  // 항목, 국가, 시기·방법, 받는 자(명칭·연락처), 이용 목적, 보유·이용 기간.
  const processors: [string, string, string, string, string][] = [
    ["Supabase Inc.", "privacy@supabase.com", "데이터베이스 보관, 로그인과 로그인 메일", "이메일 주소, 구독 정보, Insight Lab 기록, AI 사용량 기록", `${facts.databaseRegion}`],
    ["Vercel Inc.", "privacy@vercel.com", "웹사이트 호스팅과 서버 처리", "접속 기록(IP 등), 폼에 입력한 내용", "미국(서버 처리), 전 세계 캐시"],
    ["Brevo SAS", "dpo@brevo.com", "구독 확인·뉴스레터 메일 발송, 운영자 알림 메일", "이메일 주소, 발송·열람·클릭 기록, 남긴 의견", "EU"],
    ["Google LLC", "policies.google.com/privacy", "방문 통계(Analytics), AI 응답 생성(Gemini)", "쿠키·기기 정보·방문 페이지, AI 기능에 입력한 문장", "미국"],
    ["Anthropic PBC", "anthropic.com/legal", "AI 응답 생성(Gemini 장애 시 대체 경로)", "AI 기능에 입력한 문장", "미국"],
    ["OpenAI, L.L.C.", "privacy@openai.com", "AI 응답 생성(두 번째 대체 경로)", "AI 기능에 입력한 문장", "미국"],
    // ImprovMX: 개인정보 처리방침·GDPR 안내·로그 안내(2026-10-25 확인). 개인정보 문의 이메일은 공개돼 있지 않아 공식 문의 양식을 적는다.
    ["ImprovMX Incorporation", "improvmx.com/contact(문의 양식)", "문의 메일 수신과 운영자 메일함으로 전달", "문의 메일(보낸 사람 주소·제목·내용), 전달 기록", "프랑스(수신·임시 보관, 전달 후 삭제), 프랑스·미국(전달). 전달 기록 7일 후 삭제"],
    ["NAVER Corp.", "국내 위탁", "운영자 메일함에 문의 메일 보관", "문의 메일(보낸 사람 주소·제목·내용)", "대한민국"],
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
          <p>{facts.disposalProcess}</p>
          <p>{facts.lawfulRetention}</p>
          <p>뉴스레터에는 광고를 싣지 않습니다. 광고를 싣게 되면 기존 구독과 별도로 광고성 정보 수신 동의를 받습니다. 모든 메일에는 발신자와 수신 거부 링크가 있습니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-refuse">
          <h2 id="privacy-refuse">2. 동의를 거부할 권리</h2>
          <p>개인정보 제공을 거부할 수 있습니다. 거부하면 뉴스레터 수신이나 Insight Lab 기록 저장을 이용할 수 없으며, 사이트 열람은 그대로 가능합니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-processors">
          <h2 id="privacy-processors">3. 처리 위탁과 국외 이전</h2>
          <table className="ml-privacy-table">
            <thead><tr><th scope="col">받는 자(연락처)</th><th scope="col">맡기는 일</th><th scope="col">처리 항목</th><th scope="col">처리 위치</th></tr></thead>
            <tbody>{processors.map(([company, contact, job, items, place]) => <tr key={company}><th scope="row">{company}<br />{contact}</th><td>{job}</td><td>{items}</td><td>{place}</td></tr>)}</tbody>
          </table>
          <p>서비스를 이용할 때마다 네트워크로 전송되며, 위 1번의 보유 기간 동안 처리합니다. 국외 이전을 원하지 않으면 뉴스레터 구독, Insight Lab 로그인, AI 기능을 이용하지 않거나 삭제를 요청할 수 있습니다. 이 경우 해당 기능은 이용할 수 없고, 사이트 열람은 그대로 가능합니다. 제3자에게 개인정보를 제공하지 않습니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">4. 정보주체의 권리와 행사 방법</h2>
          <p>열람·정정·삭제·처리정지를 요청할 수 있습니다. 뉴스레터는 메일 하단의 구독 해지 링크로 바로 해지되고 구독 정보도 함께 삭제됩니다. Insight Lab 탈퇴, 기록 삭제와 그 밖의 요청은 {facts.contactEmail} 로 보내 주세요. 요청한 주소에서 온 메일인지 확인한 뒤 지체 없이 처리하고 결과를 회신합니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-cookies">
          <h2 id="privacy-cookies">5. 자동 수집 장치(쿠키)의 설치·운영과 거부</h2>
          <p>방문 통계를 위해 Google Analytics 쿠키를 사용합니다. 관리자·로그인 화면에서는 사용하지 않습니다. 브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있습니다(Chrome·Edge·Whale: 설정 → 개인정보(또는 쿠키 및 사이트 권한) → 쿠키, Safari: 설정 → 개인정보 보호). 거부해도 사이트 이용에는 영향이 없습니다.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-safety">
          <h2 id="privacy-safety">6. 안전성 확보 조치</h2>
          <p>전송 구간 암호화(HTTPS), 데이터베이스 접근 권한 분리(행 단위 보안), 관리자 인증, 구독 이중 확인, 원문 IP 미저장.</p>
        </section>
        <section className="ml-page-section" aria-labelledby="privacy-officer">
          <h2 id="privacy-officer">7. 개인정보 보호책임자와 고충처리 창구</h2>
          <p>개인정보 처리에 관한 업무는 운영자가 직접 총괄하며, 개인정보 보호 관련 문의·불만 처리·피해 구제는 아래 창구에서 처리합니다. 문의에는 지체 없이 답변합니다.</p>
          <p>{facts.privacyOfficer} · {facts.contactEmail}</p>
          {facts.operatorType === "business"
            ? <p>운영 주체: {facts.operator} · 대표자: {facts.representative}</p>
            : <p>운영 주체: {facts.operator}(개인 운영)</p>}
        </section>
      </div>
    </div>
  )
}
