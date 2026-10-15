// Brand Watch launch dataset (reviewed 2026-10-13/14 from public sources; see docs/brand-watch-launch-source-pack.md).
// Stored per source: title, provider, canonical URL, published date/precision only. No article body is stored.
// Evidence = one short MarkLens-written factual sentence plus a short verbatim support quote.
// Patterns / Takes / Snapshots are manually authored MarkLens analysis (no model call), reviewed before publish.
// Importing this file performs no database access.

type Slug = "musinsa" | "olive-young" | "toss" | "baemin" | "danggeun"
type Precision = "day" | "month" | "year" | "unknown"
export const LAUNCH_REVIEWED_AT = "2026-10-14T03:00:00Z"
const id = (n: number) => `c7000000-0000-4000-8000-${String(n).padStart(12, "0")}`

export interface LaunchProvider { id: string; name: string; domain: string; providerType: "official_newsroom" | "official_blog" | "industry_media" | "business_media" | "other_media"; sourceTier: 1 | 2 | 3 }
export interface LaunchSource { id: string; providerId: string; title: string; url: string; publishedAt: string | null; datePrecision: Precision; matches: { entity: Slug }[] }
export interface LaunchEvidence { id: string; entity: Slug; sourceId: string; fact: string; supportText: string; eventDate: string | null; datePrecision: Precision; decision: { action: "approve"; reason: string } | { action: "reject"; reason: string } }
export interface LaunchMovement { id: string; entity: Slug; eventKey: string; title: string; summary: string; movementType: "campaign" | "creator" | "partnership" | "product" | "promotion" | "platform" | "brand"; scope: "local" | "national" | "global"; market: string[]; channel: ("online" | "offline" | "social" | "retail")[]; importance: 1 | 2 | 3; evidenceIds: string[]; themes: string[]; lastObservedAt: string; reason: string }
export interface LaunchPattern { id: string; entity: Slug; title: string; description: string; windowStart: string; windowEnd: string; movementIds: string[]; uncertainties: string[]; reason: string }
export interface LaunchTake { id: string; entity: Slug; patternId: string; whatWeSee: string; whyItMayMatter: string; whatToWatchNext: string; evidenceIds: string[]; uncertainties: string[]; reason: string }
export interface LaunchSnapshot { id: string; entity: Slug; headline: string; body: string; watchNext: string; validFrom: string; takeIds: string[]; uncertainties: string[]; reason: string }

export const launchThemes = [
  { id: id(801), slug: "global", name: "Global" },
  { id: id(802), slug: "offline", name: "Offline" },
  { id: id(803), slug: "beauty", name: "Beauty" },
  { id: id(804), slug: "membership", name: "Membership" },
  { id: id(805), slug: "community", name: "Community" },
  { id: id(806), slug: "local-business", name: "Local Business" },
  { id: id(807), slug: "everyday-services", name: "Everyday Services" },
] as const
const theme = (slug: (typeof launchThemes)[number]["slug"]) => launchThemes.find(row => row.slug === slug)!.id

export const launchProviders: LaunchProvider[] = [
  { id: id(101), name: "CJ올리브영 뉴스룸", domain: "corp.oliveyoung.com", providerType: "official_newsroom", sourceTier: 1 },
  { id: id(102), name: "더팩트", domain: "news.tf.co.kr", providerType: "business_media", sourceTier: 2 },
  { id: id(103), name: "무신사 스토어", domain: "www.musinsa.com", providerType: "official_blog", sourceTier: 1 },
  { id: id(104), name: "서울경제", domain: "www.sedaily.com", providerType: "business_media", sourceTier: 2 },
  { id: id(105), name: "아이뉴스24", domain: "m.inews24.com", providerType: "business_media", sourceTier: 2 },
  { id: id(106), name: "전자신문", domain: "www.etnews.com", providerType: "industry_media", sourceTier: 2 },
  { id: id(107), name: "뉴스핌", domain: "www.newspim.com", providerType: "business_media", sourceTier: 2 },
  { id: id(108), name: "SBS Biz", domain: "biz.sbs.co.kr", providerType: "business_media", sourceTier: 2 },
  { id: id(109), name: "토스 뉴스룸", domain: "toss.im", providerType: "official_newsroom", sourceTier: 1 },
  { id: id(110), name: "인사이트", domain: "www.insight.co.kr", providerType: "other_media", sourceTier: 3 },
  { id: id(111), name: "바이라인네트워크", domain: "byline.network", providerType: "industry_media", sourceTier: 2 },
  { id: id(112), name: "허프포스트코리아", domain: "www.huffingtonpost.kr", providerType: "other_media", sourceTier: 2 },
  { id: id(113), name: "포인트데일리", domain: "www.pointdaily.co.kr", providerType: "other_media", sourceTier: 3 },
  { id: id(114), name: "뉴데일리경제", domain: "biz.newdaily.co.kr", providerType: "business_media", sourceTier: 2 },
  { id: id(115), name: "한국금융신문", domain: "www.fntimes.com", providerType: "business_media", sourceTier: 2 },
  { id: id(116), name: "당근 보도자료", domain: "about.daangn.com", providerType: "official_newsroom", sourceTier: 1 },
  { id: id(117), name: "벤처스퀘어", domain: "www.venturesquare.net", providerType: "industry_media", sourceTier: 2 },
]

const kst = (day: string, time = "00:00") => `${day}T${time}:00+09:00`
const src = (n: number, provider: number, title: string, url: string, publishedAt: string | null, datePrecision: Precision, ...entities: Slug[]): LaunchSource =>
  ({ id: id(n), providerId: id(provider), title, url, publishedAt, datePrecision, matches: entities.map(entity => ({ entity })) })

export const launchSources: LaunchSource[] = [
  // OLIVE YOUNG
  src(201, 101, "사흘간 10만명 홀린 ‘K뷰티 놀이터’…CJ올리브영, 첫 ‘올리브영 페스타 LA’ 성료", "https://corp.oliveyoung.com/ko/newsroom/press/137", kst("2026-08-18"), "day", "olive-young"),
  src(202, 102, "올리브영, 미국 첫 '올리브영 페스타 LA' 성료…사흘간 현지 10만명 홀렸다", "https://news.tf.co.kr/read/economy/2354861.htm", kst("2026-08-18", "10:01"), "day", "olive-young"),
  src(203, 101, "CJ올리브영, K-로컬 감성 더한 ‘산리오캐릭터즈’ 대규모 컬래버 진행", "https://corp.oliveyoung.com/ko/newsroom/press/138", kst("2026-08-24"), "day", "olive-young"),
  src(204, 101, "CJ올리브영, 산리오캐릭터즈와 전국 온·오프라인 프로모션 전개", "https://corp.oliveyoung.com/ko/newsroom/press/141", kst("2026-09-07"), "day", "olive-young"),
  src(205, 101, "CJ올리브영, 부산 ‘남포 타운·밀락더마켓점’ 오픈…비수도권 글로벌 거점화 속도", "https://corp.oliveyoung.com/ko/newsroom/press/140", kst("2026-09-02"), "day", "olive-young"),
  src(206, 101, "\"매장 밖으로 나온 체험형 뷰티\"...CJ올리브영, 모바일 피부 진단 서비스 오픈", "https://corp.oliveyoung.com/ko/newsroom/press/232", kst("2026-09-15"), "day", "olive-young"),
  src(207, 101, "CJ올리브영, 동남아 세포라 매장 입점 완료…싱가포르서 기념 팝업 개최", "https://corp.oliveyoung.com/ko/newsroom/press/288", kst("2026-10-12"), "day", "olive-young"),
  src(208, 101, "CJ올리브영, ’26 하반기 신입사원 채용… ‘일자리 확대’ 넘어 ‘인재 육성’ 가속화", "https://corp.oliveyoung.com/ko/newsroom/press/235", kst("2026-09-17"), "day", "olive-young"),
  // MUSINSA
  src(211, 103, "무신사와 게임 밖으로 나온 로블록스의 세계", "https://www.musinsa.com/content/1528923777154874918", null, "unknown", "musinsa"),
  src(212, 104, "무신사, 中 상하이서 K패션 판로 확대…팝업스토어 운영", "https://www.sedaily.com/article/20095452", kst("2026-09-28", "10:22"), "day", "musinsa"),
  src(213, 105, "무신사, 오사카서 첫 대형 팝업…K패션 70여개 브랜드 집결", "https://m.inews24.com/v/2006389", kst("2026-09-16", "17:10"), "day", "musinsa"),
  src(214, 106, "무신사, FW시즌 프로모션 '온&오프 페스티벌' 실시", "https://www.etnews.com/20261008000115", kst("2026-10-08", "10:28"), "day", "musinsa"),
  src(215, 107, "매장 방문 2배 늘어난 무신사…'온·오프라인 연계 페스티벌' 개최", "https://www.newspim.com/news/view/20261008000081", kst("2026-10-08", "08:56"), "day", "musinsa"),
  src(216, 108, "무신사 29CM, 이구홈 서울숲 오픈…\"최대 90% 할인\"", "https://biz.sbs.co.kr/amp/article/20000334134", kst("2026-09-11", "13:15"), "day", "musinsa"),
  // TOSS
  src(221, 109, "토스, 홈페이지 전면 개편… 금융 넘어 일상으로 나아가는 여정 담았다", "https://toss.im/newsroom/toss-new-homepage", kst("2026-08-18"), "day", "toss"),
  src(222, 109, "'앱인토스' 출시 1년 만에 미니앱 1만 개… 금융 넘어 ‘일상의 슈퍼앱’ 도약", "https://toss.im/newsroom/apps-in-toss-10000", kst("2026-08-14"), "day", "toss"),
  src(223, 110, "토스 안에 '앱 1만개' 들어왔다...금융앱인 줄 알았는데 '동네'가 됐다", "https://www.insight.co.kr/news/568211", kst("2026-08-14", "14:02"), "day", "toss"),
  src(224, 111, "토스 “앱인토스 미니앱 1만3000개 돌파…AI로 안전성 검수”", "https://byline.network/2026/09/0923-5/", kst("2026-09-27", "11:29"), "day", "toss"),
  src(225, 109, "토스, 외국인 유학생 대상 선불카드 제공… “한국에서의 첫 금융생활 돕는다”", "https://toss.im/newsroom/toss-prepaid-card-international-students", kst("2026-08-27"), "day", "toss"),
  src(226, 109, "토스플레이스, '찾아가는 토스플레이스' 첫 간담회… 사장님 30여 명 목소리 직접 들었다", "https://toss.im/newsroom/toss-place-merchant-feedback", kst("2026-08-21"), "day", "toss"),
  // BAEMIN
  src(231, 107, "배달의민족, 내달 포인트 적립형 배민클럽 출시", "https://www.newspim.com/news/view/20260901000131", kst("2026-09-01", "09:10"), "day", "baemin"),
  src(232, 112, "배민 '음식점 단골' 넘어서 '플랫폼 단골' 만든다 : 배달·장보기·쇼핑 결제 때 적립 늘려 멤버십 전방위 강화", "https://www.huffingtonpost.kr/article/260905", null, "unknown", "baemin"),
  src(233, 113, "배민, 추석 맞이 '9월말 투아웃' 캠페인 전개", "https://www.pointdaily.co.kr/news/articleView.html?idxno=320426", kst("2026-09-23", "16:36"), "day", "baemin"),
  src(234, 114, "배달 음식 넘어 화장품까지 … 배민, '뷰티 즉시배달' 키운다", "https://biz.newdaily.co.kr/site/data/html/2026/10/07/2026100700056.html", kst("2026-10-07", "08:58"), "day", "baemin"),
  src(235, 115, "배달의민족, 10월 ‘우아한테크콘퍼런스 2026’ 개최", "https://www.fntimes.com/html/view.php?ud=202609221525018906b5b890e35c_18", kst("2026-09-22", "15:26"), "day", "baemin"),
  // DANGGEUN (one source also mentions TOSS through Toss Place)
  src(241, 116, "당근, 연중 최대 중고거래의 날 ‘당근절’ 개최", "https://about.daangn.com/company/pr/archive/당근-연중-최대-중고거래의-날-당근절-개최/", kst("2026-09-29"), "day", "danggeun"),
  src(242, 117, "당근, 10월 10일 ‘당근절’ 처음 연다…바로구매 배송비 최대 5번 무료", "https://www.venturesquare.net/1116788/", kst("2026-09-29"), "day", "danggeun"),
  src(243, 116, "‘배송비 0원’에 중고시장 들썩…‘당근절’ 거래량 141% 급증", "https://about.daangn.com/company/pr/archive/배송비-0원에-중고시장-들썩-당근절-거래량-141-급증/", kst("2026-10-11"), "day", "danggeun"),
  src(244, 116, "당근모임, ‘러닝 기록 꾸미기’ 기능 출시", "https://about.daangn.com/company/pr/archive/당근모임-러닝-기록-꾸미기-기능-출시/", kst("2026-09-18"), "day", "danggeun"),
  src(245, 116, "당근, 국내 광고 플랫폼 최초로 ‘광고 MCP’ 출시", "https://about.daangn.com/company/pr/archive/당근-국내-광고-플랫폼-최초로-광고-mcp-출시/", kst("2026-09-16"), "day", "danggeun"),
  src(246, 116, "당근, 기후에너지환경부·한국환경보전원과 ‘지구를 위한 동네모임’ 캠페인 진행", "https://about.daangn.com/company/pr/archive/당근-기후에너지환경부-한국환경보전원과-지구를-위한-동네모임-캠페인-진행/", kst("2026-09-01"), "day", "danggeun"),
  src(247, 116, "당근, 전국 40만 토스 가맹점 품는다…홍보·주문·결제 하나로", "https://about.daangn.com/company/pr/archive/당근-전국-40만-토스-가맹점-품는다홍보주문결제-하나로/", kst("2026-08-13"), "day", "danggeun", "toss"),
  src(248, 116, "당근부동산, ‘살아본 후기 지도’ 기능 출시", "https://about.daangn.com/company/pr/archive/당근부동산-살아본-후기-지도-기능-출시/", kst("2026-08-28"), "day", "danggeun"),
]

const approve = (reason: string) => ({ action: "approve" as const, reason })
const reject = (reason: string) => ({ action: "reject" as const, reason })
const ev = (n: number, entity: Slug, source: number, fact: string, supportText: string, eventDate: string | null, datePrecision: Precision, decision: LaunchEvidence["decision"]): LaunchEvidence =>
  ({ id: id(n), entity, sourceId: id(source), fact, supportText, eventDate, datePrecision, decision })
const actor = approve("주체·날짜·지지 문장 확인 — 브랜드의 직접 행동")

export const launchEvidence: LaunchEvidence[] = [
  // OLIVE YOUNG
  ev(301, "olive-young", 201, "올리브영은 2026년 8월 14~16일(현지시간) 미국 로스앤젤레스에서 첫 '올리브영 페스타 LA 2026'을 열었고, 회사 발표 기준 10만명이 방문했다.", "CJ올리브영(이하 올리브영)은 지난 14일부터 16일(현지시간)까지 미국 캘리포니아주 로스앤젤레스에서 개최한 ‘올리브영 페스타 LA 2026’에 10만명의 관람객이 찾았다고 18일 밝혔다.", "2026-08-14", "day", actor),
  ev(302, "olive-young", 202, "올리브영 페스타 LA 2026은 KCON LA 2026과 연계해 열렸고 55개 K뷰티·라이프스타일 브랜드가 참여했다.", "글로벌 K컬처 축제인 'KCON LA 2026'과 연계해 열린 이번 행사에는 1422평 규모 공간에 55개 K뷰티·라이프스타일 브랜드가 참여했다.", null, "unknown", approve("독립 매체 보도 — 같은 행사(페스타 LA)의 추가 근거")),
  ev(303, "olive-young", 203, "올리브영은 산리오캐릭터즈와 'OLIVE YOUNG City Log'를 주제로 2026년 8월 30일부터 9월 30일까지 컬래버레이션 캠페인을 진행했다.", "오는 8월 30일부터 9월 30일까지 한 달간 진행되는 이번 캠페인의 주제는 ‘올리브영 시티 로그(OLIVE YOUNG City Log)’다.", "2026-08-30", "day", actor),
  ev(304, "olive-young", 204, "올리브영은 2026년 9월 한 달간 산리오캐릭터즈 사은품과 쇼핑 혜택을 제공했다.", "올리브영은 9월 한 달간 산리오캐릭터즈의 매력을 담은 사은품과 쇼핑 혜택을 선보인다.", "2026-09-01", "month", approve("같은 캠페인의 두 번째 공식 발표 — 별도 Movement로 만들지 않음")),
  ev(305, "olive-young", 205, "올리브영은 2026년 8월 28일 부산 남포동의 '올리브영 남포 타운'을 확장 이전했다.", "올리브영은 지난 28일 부산광역시 중구 남포동에 비수도권 최대 규모 타운매장 ‘올리브영 남포 타운’(이하 남포 타운)을 확장 이전한 데 이어", "2026-08-28", "day", actor),
  ev(306, "olive-young", 205, "올리브영은 2026년 8월 30일 부산 수영구 민락동에 디자인 특화 매장 '올리브영 밀락더마켓점'을 열었다.", "30일 수영구 민락동에 디자인 특화 매장 ‘올리브영 밀락더마켓점’(이하 밀락더마켓점)을 오픈했다고 밝혔다.", "2026-08-30", "day", actor),
  ev(307, "olive-young", 206, "올리브영은 매장의 피부 측정 서비스 '스킨스캔'을 앱에 구현한 모바일 피부 진단 서비스를 선보였다.", "모바일 피부 진단은 매장에서 운영 중인 체험형 뷰티 서비스 '스킨스캔'을 올리브영 앱에 구현한 것이다.", null, "unknown", actor),
  ev(308, "olive-young", 207, "올리브영이 큐레이션한 '올리브영 K뷰티에딧'이 말레이시아·싱가포르·태국·홍콩 세포라 온·오프라인에 입점했다.", "올리브영이 큐레이션한 ‘올리브영 K뷰티에딧’ 말레이시아·싱가포르·태국·홍콩 세포라 온오프라인 입점", null, "unknown", approve("입점 상품은 올리브영이 큐레이션한 외부 K뷰티 브랜드 — PB가 아니므로 올리브영의 직접 행동")),
  ev(309, "olive-young", 207, "올리브영은 2026년 10월 8일부터 14일까지 싱가포르 아이온 오차드에서 세포라 입점 기념 팝업을 운영했다.", "지난 8일부터 오는 14일까지 일주일 간", "2026-10-08", "day", actor),
  ev(310, "olive-young", 208, "올리브영은 2026년 하반기 신입사원 채용을 진행한다.", "CJ올리브영, ’26 하반기 신입사원 채용", null, "unknown", reject("채용 공고 — 마케팅·소비자 접점 움직임이 아님")),
  // MUSINSA
  ev(311, "musinsa", 211, "무신사 스토어 성수에서 로블록스를 주제로 한 무신사 드롭 팝업이 2026년 7월 26일부터 8월 12일까지 운영됐다.", "위치 : 무신사 스토어 성수 (서울 성동구 성수이로 74 / 11:00 - 22:00) 기간 : 07.26(일) - 08.12(수)", "2026-07-26", "day", approve("공식 무신사 콘텐츠 — 요일 표기로 2026년 확인")),
  ev(312, "musinsa", 212, "무신사는 2026년 8월 21일부터 11월 30일까지 상하이 징안 캐리 센터에서 '무신사 상하이 팝업 스토어 2026'을 운영한다.", "지난달 21일부터 11월 30일까지 상하이 난징시루 '징안 캐리 센터'에서 진행되는 이번 팝업은 산업통상부와 대한무역투자진흥공사(코트라)의 '유통기업 해외진출 지원사업' 지원을 받아 추진됐다.", "2026-08-21", "day", approve("9월 28일 기사의 '지난달 21일' = 8월 21일로 확인")),
  ev(313, "musinsa", 213, "무신사는 10월 23일부터 11월 8일까지 오사카 '그랜드 그린 오사카 브이에스'에서 첫 대형 팝업 '무신사 오사카 팝업 스토어 2026'을 운영한다고 발표했다.", "무신사는 오는 10월 23일부터 11월 8일까지 17일간 일본 오사카 '그랜드 그린 오사카 브이에스'에서 '무신사 오사카 팝업 스토어 2026'을 운영한다고 16일 밝혔다.", null, "unknown", approve("예정 행사의 발표 — 날짜는 보도일 기준으로만 표시")),
  ev(314, "musinsa", 214, "무신사는 10월 19일까지 무신사 스토어 온라인과 오프라인 매장에서 FW 시즌 프로모션 '온 & 오프 페스티벌'을 진행한다.", "무신사는 오는 19일까지 무신사 스토어 온라인과 오프라인 매장에서 가을·겨울(FW) 시즌 프로모션 '온 & 오프 페스티벌'을 진행한다고 8일 밝혔다.", null, "unknown", actor),
  ev(315, "musinsa", 215, "무신사에 따르면 2026년 9월 오프라인 매장 방문객은 전년 동월의 약 2.8배였다.", "무신사에 따르면 지난달 오프라인 매장 방문객은 전년 동월의 약 2.8배로 늘었다.", null, "unknown", approve("회사 발표 수치 — 독립 집계 아님")),
  ev(316, "musinsa", 216, "29CM가 서울 성수동에 다섯 번째 매장 '이구홈 서울숲'을 열었다.", "무신사 29CM가 서울 성수동에 이구홈 서울숲을 개점했다고 오늘(11일) 밝혔습니다.", null, "unknown", reject("29CM은 MUSINSA와 분리된 관련 브랜드 — 제목의 '무신사' 언급만으로 MUSINSA core 행동이 되지 않음")),
  // TOSS
  ev(321, "toss", 221, "토스는 공식 홈페이지를 전면 개편하고 '금융부터 일상까지, 마침내 토스 하나로'라는 메시지로 서비스를 하나의 이야기로 엮었다.", "쉬운 송금에서 출발해 금융을 넘어 일상으로, 또 국내에서 글로벌로 확장해 온 과정을 '금융부터 일상까지, 마침내 토스 하나로'라는 메시지 아래 하나의 이야기로 엮었다.", null, "unknown", actor),
  ev(322, "toss", 222, "토스의 미니앱 플랫폼 '앱인토스'의 제휴 미니앱 수가 1만 개를 넘었다.", "토스의 미니앱 플랫폼 '앱인토스'의 제휴 미니앱 수가 1만 개를 돌파했다.", null, "unknown", actor),
  ev(323, "toss", 223, "앱인토스의 월 이용자는 400만명 수준이다.", "한 달에 400만명이 앱인토스를 찾는다.", null, "unknown", approve("독립 매체 보도 — 같은 이정표의 추가 근거")),
  ev(324, "toss", 224, "토스는 앱인토스에서 운영 중인 미니앱이 1만3000개를 넘었고 AI로 미니앱 안전성을 검수한다고 밝혔다.", "토스 “앱인토스 미니앱 1만3000개 돌파…AI로 안전성 검수”", null, "unknown", approve("출시 시점 표기는 공식 발표와 달라 사실로 채택하지 않음")),
  ev(325, "toss", 225, "토스는 전국 15개 대학 국제처를 통해 신입 외국인 유학생에게 국내 계좌 없이 쓸 수 있는 선불카드를 제공한다.", "토스가 외국인 유학생의 초기 금융생활을 지원하기 위해 전국 15개 대학 국제처를 통해 선불카드를 제공한다고 밝혔다.", null, "unknown", actor),
  ev(326, "toss", 226, "토스플레이스가 가맹점 사장 30여 명과 첫 간담회를 열었다.", "토스플레이스, '찾아가는 토스플레이스' 첫 간담회", null, "unknown", reject("토스플레이스는 TOSS core와 분리된 관련 법인 후보 — TOSS 행동으로 승인하지 않음")),
  // BAEMIN
  ev(331, "baemin", 231, "우아한형제들은 결제 금액에 따라 배민포인트를 적립하는 신규 배민클럽 상품을 2026년 10월 1일 출시한다고 밝혔다.", "배달의민족 운영사 우아한형제들은 결제 금액에 따라 배민포인트를 적립해주는 신규 배민클럽 상품을 다음달 1일 출시한다고 1일 밝혔다.", "2026-10-01", "day", approve("9월 1일 기사의 '다음달 1일' = 10월 1일 출시일")),
  ev(332, "baemin", 232, "배민클럽 에디션2는 음식 배달과 픽업, 장보기·쇼핑 결제 금액의 5%(배민페이머니·연결계좌) 또는 2%(배민페이카드)를 적립한다.", "음식 배달과 픽업, 장보기·쇼핑에서 배민페이머니나 연결계좌로 결제하면 5%, 배민페이카드로 결제하면 2%를 적립한다.", null, "unknown", approve("기사에 게재일 표기 없음 — 출처 날짜는 미상으로 둠")),
  ev(333, "baemin", 233, "우아한형제들은 서울시와 '9월말 투아웃' 캠페인을 진행하며 참여 고객에게 픽업 주문 쿠폰을 선착순으로 제공했다.", "캠페인에 참여하는 고객들에게는 픽업 주문 시 사용 가능한 쿠폰을 선착순으로 제공한다.", null, "unknown", actor),
  ev(335, "baemin", 234, "뷰티 판매점 오프뷰티가 2026년 10월 8일부터 배민 퀵커머스 서비스 '장보기·쇼핑'에 입점했다.", "배민 운영사 우아한형제들은 큐앤드비인터내셔날이 운영하는 뷰티 판매점 오프뷰티가 8일부터 퀵커머스 서비스 '장보기·쇼핑'에 입점한다고 7일 밝혔다.", "2026-10-08", "day", actor),
  ev(336, "baemin", 235, "우아한형제들이 기술 행사 '우아한테크콘퍼런스 2026'을 연다.", "배달의민족, 10월 ‘우아한테크콘퍼런스 2026’ 개최", null, "unknown", reject("우아한형제들 기업·기술 행사 — BAEMIN 소비자 마케팅 움직임이 아님")),
  // DANGGEUN
  ev(341, "danggeun", 241, "당근은 2026년 10월 10일 처음으로 중고거래 행사 '당근절'을 연다고 밝혔다.", "국내 대표 지역생활 커뮤니티 당근이 오는 10월 10일, 연중 최대 중고거래의 날 ‘당근절’을 개최한다고 29일 밝혔다.", "2026-10-10", "day", actor),
  ev(342, "danggeun", 242, "당근절 당일 바로구매 물품을 사면 1인 최대 5회까지 배송비가 지원됐다.", "당근, 10월 10일 ‘당근절’ 처음 연다…바로구매 배송비 최대 5번 무료", "2026-10-10", "day", approve("보도자료 기반 기사 — 같은 행사, 별도 Movement 아님")),
  ev(343, "danggeun", 243, "당근에 따르면 당근절 당일 중고거래 건수는 평소 토요일보다 141% 많았다.", "국내 대표 지역생활 커뮤니티 당근이 지난 10일 처음 개최한 ‘당근절’에 이용자들이 대거 몰리며 중고거래 건수가 평소 토요일 대비 141% 급증했다고 11일 밝혔다.", "2026-10-10", "day", approve("회사 발표 수치 — 독립 집계 아님")),
  ev(344, "danggeun", 244, "당근은 외부 러닝 앱 기록을 연동해 꾸미고 이웃과 공유하는 당근모임 '러닝 기록 꾸미기' 기능을 출시했다.", "러닝 기록 꾸미기는 외부 러닝 앱의 기록 화면을 직접 캡쳐해 올릴 필요 없이, 해당 앱에 저장된 달리기 기록을 당근으로 연동해 꾸미고 인증할 수 있는 기능이다.", null, "unknown", actor),
  ev(345, "danggeun", 245, "당근은 국내 광고 플랫폼 최초로 광고주 대상 모델 컨텍스트 프로토콜(MCP)을 도입했다고 밝혔다.", "국내 대표 지역생활 커뮤니티 당근이 국내 광고 플랫폼 최초로 광고주 대상 ‘모델 컨텍스트 프로토콜(MCP)’을 도입했다고 밝혔다.", null, "unknown", actor),
  ev(346, "danggeun", 246, "당근은 기후에너지환경부·한국환경보전원과 2026년 9월 1일부터 15일까지 '지구를 위한 동네모임' 캠페인을 진행했다.", "이날부터 오는 15일까지 2주간 진행되는 이번 캠페인은 평소 이웃과 함께 즐기던 모임 활동을 통해, 쉽고 재미있게 기후행동을 실천할 수 있도록 기획됐다.", "2026-09-01", "day", actor),
  ev(347, "danggeun", 247, "당근은 토스플레이스와 제휴해 전국 40만 개 이상 매장의 홍보·주문·결제 시스템을 연동한다고 밝혔다.", "당근이 토스플레이스와 손잡고 전국 40만 개 이상 매장의 홍보·주문·결제 시스템을 연동한다.", null, "unknown", approve("당근이 직접 행동 주체. 상대방은 토스 자회사 토스플레이스이므로 TOSS core에는 연결하지 않음")),
  ev(348, "danggeun", 248, "당근부동산이 '살아본 후기 지도' 기능을 출시했다.", "당근부동산, ‘살아본 후기 지도’ 기능 출시", null, "unknown", reject("당근부동산은 관계 검토가 필요한 주요 확장 서비스 — DANGGEUN core 행동으로 승인하지 않음")),
]

const mv = (n: number, entity: Slug, eventKey: string, title: string, summary: string, movementType: LaunchMovement["movementType"], scope: LaunchMovement["scope"], market: string[], channel: LaunchMovement["channel"], importance: 1 | 2 | 3, evidence: number[], themes: string[], lastObservedAt: string): LaunchMovement =>
  ({ id: id(n), entity, eventKey, title, summary, movementType, scope, market, channel, importance, evidenceIds: evidence.map(id), themes, lastObservedAt, reason: "공개 출처로 확인된 단일 사건 — 같은 사건의 보도는 하나로 묶음" })

export const launchMovements: LaunchMovement[] = [
  mv(401, "olive-young", "olive-young-festa-la-2026", "올리브영 페스타 LA 2026 개최", "미국 로스앤젤레스에서 첫 '올리브영 페스타 LA'를 사흘간 열었다. KCON LA 2026과 연계해 55개 K뷰티·라이프스타일 브랜드가 참여했다.", "campaign", "global", ["US"], ["offline"], 3, [301, 302], [theme("global"), theme("beauty")], kst("2026-08-18", "10:01")),
  mv(402, "olive-young", "olive-young-sanrio-city-log-2026", "산리오캐릭터즈 컬래버 'OLIVE YOUNG City Log' 캠페인", "8월 30일부터 9월 30일까지 산리오캐릭터즈와 컬래버레이션 캠페인을 진행했다. 9월 한 달간 사은품과 쇼핑 혜택을 함께 제공했다.", "partnership", "national", ["KR"], ["online", "offline"], 2, [303, 304], [theme("offline")], kst("2026-09-07")),
  mv(403, "olive-young", "olive-young-busan-stores-2026-08", "부산 남포 타운 확장 이전·밀락더마켓점 오픈", "8월 28일 부산 남포동 타운 매장을 확장 이전하고 30일 민락동에 디자인 특화 매장을 열었다.", "platform", "local", ["KR"], ["offline", "retail"], 2, [305, 306], [theme("offline")], kst("2026-09-02")),
  mv(404, "olive-young", "olive-young-mobile-skin-scan-2026", "모바일 피부 진단 서비스 출시", "매장에서 운영하던 체험형 피부 측정 서비스 '스킨스캔'을 올리브영 앱에 구현했다.", "product", "national", ["KR"], ["online"], 2, [307], [theme("beauty")], kst("2026-09-15")),
  mv(405, "olive-young", "olive-young-sephora-sea-2026", "동남아 세포라 'K뷰티에딧' 입점·싱가포르 팝업", "올리브영이 큐레이션한 K뷰티 상품군이 말레이시아·싱가포르·태국·홍콩 세포라 온·오프라인에 입점했고, 싱가포르에서 기념 팝업을 열었다.", "partnership", "global", ["MY", "SG", "TH", "HK"], ["online", "offline", "retail"], 3, [308, 309], [theme("global"), theme("beauty")], kst("2026-10-12")),
  mv(411, "musinsa", "musinsa-seongsu-roblox-drop-2026", "무신사 스토어 성수 로블록스 팝업", "무신사 드롭이 로블록스를 주제로 한 팝업을 무신사 스토어 성수에서 7월 26일부터 8월 12일까지 운영했다.", "partnership", "local", ["KR"], ["offline", "retail"], 1, [311], [theme("offline")], "2026-10-13T12:00:00+09:00"),
  mv(412, "musinsa", "musinsa-shanghai-popup-2026", "상하이 팝업 스토어 2026 운영", "상하이 징안 캐리 센터에서 K패션 브랜드를 소개하는 팝업을 8월 21일부터 11월 30일까지 운영한다.", "platform", "global", ["CN"], ["offline", "retail"], 3, [312], [theme("global")], kst("2026-09-28", "10:22")),
  mv(413, "musinsa", "musinsa-osaka-popup-2026", "오사카 첫 대형 팝업 개최 발표", "10월 23일부터 11월 8일까지 오사카에서 국내 패션·뷰티 브랜드를 소개하는 첫 대형 팝업을 운영한다고 발표했다.", "platform", "global", ["JP"], ["offline", "retail"], 2, [313], [theme("global")], kst("2026-09-16", "17:10")),
  mv(414, "musinsa", "musinsa-on-off-festival-fw-2026", "FW '온 & 오프 페스티벌' 진행", "10월 19일까지 무신사 스토어 온라인과 오프라인 매장에서 FW 시즌 할인 행사를 진행한다. 무신사는 9월 오프라인 매장 방문객이 전년 동월의 약 2.8배였다고 밝혔다.", "promotion", "national", ["KR"], ["online", "offline", "retail"], 2, [314, 315], [theme("offline")], kst("2026-10-08", "10:28")),
  mv(421, "toss", "toss-homepage-everyday-2026", "홈페이지 전면 개편 — '금융부터 일상까지'", "공식 홈페이지를 전면 개편해 송금에서 일상·글로벌로 넓혀 온 서비스를 하나의 메시지로 소개했다.", "brand", "national", ["KR"], ["online"], 2, [321], [theme("everyday-services")], kst("2026-08-18")),
  mv(422, "toss", "toss-apps-in-toss-10000", "앱인토스 제휴 미니앱 1만 개 돌파", "미니앱 플랫폼 앱인토스의 제휴 미니앱이 1만 개를 넘었고, 월 이용자는 400만명 수준으로 보도됐다.", "platform", "national", ["KR"], ["online"], 2, [322, 323], [theme("everyday-services")], kst("2026-08-14", "14:02")),
  mv(423, "toss", "toss-apps-in-toss-ai-review", "앱인토스 미니앱 AI 안전성 검수", "운영 중인 미니앱이 1만3000개를 넘은 가운데 AI로 미니앱 안전성을 검수한다고 밝혔다.", "platform", "national", ["KR"], ["online"], 1, [324], [theme("everyday-services")], kst("2026-09-27", "11:29")),
  mv(424, "toss", "toss-prepaid-card-students-2026", "외국인 유학생 선불카드 제공", "15개 대학 국제처를 통해 국내 계좌 없이 쓸 수 있는 선불카드를 신입 외국인 유학생에게 제공한다.", "product", "national", ["KR"], ["online", "offline"], 2, [325], [], kst("2026-08-27")),
  mv(431, "baemin", "baemin-club-edition-2", "포인트 적립형 '배민클럽 에디션2' 출시", "10월 1일 결제 금액에 따라 배민포인트를 적립하는 배민클럽 신규 상품을 출시했다. 적립은 음식 배달뿐 아니라 픽업과 장보기·쇼핑 결제에도 적용된다.", "product", "national", ["KR"], ["online"], 3, [331, 332], [theme("membership")], kst("2026-09-01", "09:10")),
  mv(432, "baemin", "baemin-seoul-two-out-2026", "서울시와 '9월말 투아웃' 픽업 캠페인", "서울시 '외로움 없는 서울' 정책과 연계해 10월 2일까지 캠페인을 진행하고 참여 고객에게 픽업 주문 쿠폰을 제공했다.", "campaign", "local", ["KR"], ["online"], 1, [333], [], kst("2026-09-23", "16:36")),
  mv(433, "baemin", "baemin-offbeauty-quick-commerce", "장보기·쇼핑에 뷰티 판매점 오프뷰티 입점", "러쉬·아리따움에 이어 뷰티 판매점 오프뷰티가 10월 8일부터 장보기·쇼핑에 입점해 화장품 즉시배달 상품군이 넓어졌다.", "product", "national", ["KR"], ["online"], 2, [335], [theme("beauty")], kst("2026-10-07", "08:58")),
  mv(441, "danggeun", "danggeun-danggeunjeol-2026", "첫 중고거래 행사 '당근절' 개최", "10월 10일 첫 '당근절'을 열고 바로구매 배송비를 1인 최대 5회까지 지원했다. 당근은 당일 중고거래 건수가 평소 토요일보다 141% 많았다고 밝혔다.", "promotion", "national", ["KR"], ["online"], 3, [341, 342, 343], [theme("community")], kst("2026-10-11")),
  mv(442, "danggeun", "danggeun-running-record-2026", "당근모임 '러닝 기록 꾸미기' 출시", "외부 러닝 앱의 달리기 기록을 연동해 꾸미고 이웃과 공유하는 기능을 당근모임에 추가했다.", "product", "national", ["KR"], ["online", "social"], 2, [344], [theme("community")], kst("2026-09-18")),
  mv(443, "danggeun", "danggeun-ads-mcp-2026", "광고주 대상 '광고 MCP' 도입", "광고주가 AI 모델·에이전트를 통해 당근 광고 정보를 조회하고 업무를 수행할 수 있도록 광고 MCP를 도입했다.", "platform", "national", ["KR"], ["online"], 2, [345], [theme("local-business")], kst("2026-09-16")),
  mv(444, "danggeun", "danggeun-earth-meetup-campaign-2026", "'지구를 위한 동네모임' 캠페인", "자원순환의 날을 앞두고 9월 1일부터 15일까지 당근모임 활동으로 기후행동을 실천하는 캠페인을 정부 기관과 함께 진행했다.", "campaign", "national", ["KR"], ["online", "offline"], 2, [346], [theme("community")], kst("2026-09-01")),
  mv(445, "danggeun", "danggeun-tossplace-integration-2026", "토스플레이스와 매장 홍보·주문·결제 연동 제휴", "토스플레이스와 제휴해 전국 40만 개 이상 매장의 홍보·주문·결제 시스템을 연동한다고 밝혔다.", "partnership", "national", ["KR"], ["online", "offline"], 2, [347], [theme("local-business")], kst("2026-08-13")),
]

const pt = (n: number, entity: Slug, title: string, description: string, windowStart: string, windowEnd: string, movements: number[], uncertainties: string[]): LaunchPattern =>
  ({ id: id(n), entity, title, description, windowStart, windowEnd, movementIds: movements.map(id), uncertainties, reason: "서로 다른 사건 키를 가진 2개 이상의 공개 Movement에서 반복된 방향 확인" })

export const launchPatterns: LaunchPattern[] = [
  pt(501, "olive-young", "해외에서 K뷰티 소비자 접점을 넓히는 활동 반복", "8월 미국 로스앤젤레스 페스타와 10월 동남아 세포라 입점·싱가포르 팝업에서 해외 소비자를 직접 만나는 활동이 이어졌다.", "2026-08-14", "2026-10-08", [401, 405], ["방문객 수 등 성과는 회사 발표 기준이며 독립 집계가 아니다."]),
  pt(502, "olive-young", "매장 체험을 팝업·특화 매장·앱으로 넓히는 활동 반복", "8월 말 성수 팝업이 포함된 산리오 캠페인과 부산 특화 매장, 9월 모바일 피부 진단까지 체험형 접점을 늘리는 활동이 이어졌다.", "2026-08-28", "2026-09-15", [402, 403, 404], ["관찰 기간이 3주 남짓으로 짧다."]),
  pt(511, "musinsa", "해외 팝업으로 K패션 브랜드를 소개하는 활동 반복", "8월 상하이 팝업에 이어 10월 오사카 대형 팝업이 발표되며 해외 소비자를 오프라인에서 만나는 활동이 이어졌다.", "2026-08-21", "2026-09-16", [412, 413], ["오사카 팝업은 발표 단계이며 개최 전이다."]),
  pt(512, "musinsa", "오프라인 매장을 활용한 행사 반복", "7~8월 무신사 스토어 성수 협업 팝업과 10월 온·오프라인 연계 할인 행사가 이어졌다.", "2026-07-26", "2026-10-08", [411, 414], ["두 행사의 성격(협업 발매·할인)이 다르다."]),
  pt(521, "toss", "금융 앱을 넘어 일상 서비스로 범위를 넓히는 메시지와 플랫폼 확장 반복", "8월 홈페이지 개편에서 '금융부터 일상까지'를 내세웠고, 미니앱 플랫폼 앱인토스는 제휴 미니앱 1만 개를 넘긴 뒤 9월 AI 안전성 검수를 공개했다.", "2026-08-14", "2026-09-27", [421, 422, 423], ["앱인토스 출시 시점은 출처마다 표기가 다르다."]),
  pt(531, "baemin", "음식 배달 밖의 장보기·쇼핑 이용을 넓히는 활동 반복", "10월 배민클럽 신규 상품이 적립 범위를 픽업·장보기·쇼핑으로 넓혔고, 같은 달 장보기·쇼핑에 뷰티 판매점이 추가로 입점했다.", "2026-10-01", "2026-10-08", [431, 433], ["관찰 기간이 일주일로 짧다."]),
  pt(541, "danggeun", "동네모임 활동을 늘리는 기능·캠페인 반복", "9월 '지구를 위한 동네모임' 캠페인과 당근모임 '러닝 기록 꾸미기' 기능 출시로 모임 활동에 참여할 계기를 더하는 움직임이 이어졌다.", "2026-09-01", "2026-09-18", [444, 442], ["모임 참여 규모는 공개되지 않았다."]),
  pt(542, "danggeun", "지역 매장·광고주를 연결하는 도구 확장 반복", "8월 토스플레이스 매장 시스템 연동 제휴와 9월 광고주 대상 광고 MCP 도입으로 지역 사업자와 광고주를 위한 연결 도구가 늘었다.", "2026-08-13", "2026-09-16", [445, 443], ["연동 매장의 실제 이용 규모는 공개되지 않았다."]),
]

const tk = (n: number, entity: Slug, pattern: number, whatWeSee: string, whyItMayMatter: string, whatToWatchNext: string, evidence: number[]): LaunchTake =>
  ({ id: id(n), entity, patternId: id(pattern), whatWeSee, whyItMayMatter, whatToWatchNext, evidenceIds: evidence.map(id), uncertainties: ["MarkLens의 해석이며 회사가 밝힌 목표가 아니다."], reason: "사실과 해석의 구분, 단정 표현 여부 검토 완료" })

export const launchTakes: LaunchTake[] = [
  tk(601, "olive-young", 501, "올리브영은 미국과 동남아에서 직접 여는 행사와 현지 유통 채널 입점을 함께 진행하고 있다.", "국내 매장에서 해 온 K뷰티 큐레이션이 해외 소비자 접점으로 옮겨 갈 수 있다는 신호로 볼 수 있다.", "세포라 입점이 다른 국가·지역으로 넓어지는지, 현지 행사가 다시 열리는지 지켜볼 만하다.", [301, 308, 309]),
  tk(602, "olive-young", 502, "올리브영은 팝업, 지역 특화 매장, 앱 기능으로 매장에서 하던 체험을 여러 접점에 나누어 제공하고 있다.", "체험 요소를 매장 밖으로 옮기는 시도는 매장 방문과 앱 이용을 서로 연결하는 방향일 수 있다.", "모바일 피부 진단 결과가 상품 추천이나 매장 방문과 어떻게 이어지는지 지켜볼 만하다.", [303, 306, 307]),
  tk(611, "musinsa", 511, "무신사는 중국과 일본에서 국내 패션·뷰티 브랜드를 모아 소개하는 팝업을 잇달아 운영·발표했다.", "온라인 스토어에서 쌓은 브랜드 큐레이션을 해외 오프라인 현장에서 시험하는 흐름으로 볼 수 있다.", "오사카 팝업이 예정대로 열린 뒤 일본·중국에서 상설 매장이나 정기 행사로 이어지는지 지켜볼 만하다.", [312, 313]),
  tk(612, "musinsa", 512, "무신사는 매장 협업 팝업과 온·오프라인 연계 할인 행사로 오프라인 매장 방문을 이끄는 활동을 이어가고 있다.", "오프라인 매장이 온라인 스토어의 할인·발매 행사를 함께 수행하는 접점으로 쓰일 수 있다.", "온 & 오프 페스티벌 이후 매장 전용 혜택이 정기 행사로 자리 잡는지 지켜볼 만하다.", [311, 314, 315]),
  tk(621, "toss", 521, "토스는 홈페이지 메시지와 미니앱 플랫폼 운영 모두에서 금융 밖의 일상 서비스를 앞세우고 있다.", "금융 앱의 사용 범위가 송금·결제를 넘어 일상 서비스로 넓어질 수 있다는 점에서 주목할 만하다.", "미니앱 수가 늘어난 뒤 노출·검수 정책이 어떻게 바뀌는지 지켜볼 만하다.", [321, 322, 324]),
  tk(631, "baemin", 531, "배민은 멤버십 적립 범위와 장보기·쇼핑 상품군을 함께 넓히고 있다.", "배달 앱 이용이 음식 주문에서 장보기·쇼핑까지 넓어지면 멤버십 혜택이 여러 서비스를 함께 쓰는 이유가 될 수 있다.", "배민클럽 에디션2 적립이 장보기·쇼핑 이용과 어떻게 연결되는지, 뷰티 외 비식품 상품군이 추가되는지 지켜볼 만하다.", [331, 332, 335]),
  tk(641, "danggeun", 541, "당근은 정부 기관과의 캠페인과 러닝 기록 기능으로 당근모임에서 함께 할 활동의 종류를 늘리고 있다.", "중고거래 외에 동네 모임 활동이 늘어나면 이용자가 앱을 찾는 이유가 지역 커뮤니티 활동으로 넓어질 수 있다.", "러닝처럼 특정 활동에 맞춘 모임 기능이 다른 활동으로 이어지는지 지켜볼 만하다.", [346, 344]),
  tk(642, "danggeun", 542, "당근은 매장 POS 연동과 광고 MCP로 지역 매장과 광고주가 당근을 쓰는 방식을 넓히고 있다.", "지역 매장의 홍보·주문·결제와 광고 집행이 한 플랫폼에서 이어질 수 있다는 점에서 지역 광고 사업과 연결될 수 있다.", "토스플레이스 연동 매장의 비즈프로필 활용이 실제로 늘어나는지 지켜볼 만하다.", [347, 345]),
]

// Snapshots only where at least two published Patterns describe a current direction; TOSS and BAEMIN stay without one.
const sn = (n: number, entity: Slug, headline: string, body: string, watchNext: string, validFrom: string, takes: number[]): LaunchSnapshot =>
  ({ id: id(n), entity, headline, body, watchNext, validFrom, takeIds: takes.map(id), uncertainties: ["두 Pattern의 관찰 기간이 서로 다르다."], reason: "현재 방향을 설명하는 Pattern 2개와 검수된 Take에 근거" })

export const launchSnapshots: LaunchSnapshot[] = [
  sn(701, "olive-young", "국내 체험형 접점과 해외 소비자 접점을 함께 넓히는 중", "최근 공개된 움직임은 두 갈래로 이어진다. 국내에서는 팝업·특화 매장·앱으로 체험형 접점을 늘렸고, 해외에서는 로스앤젤레스 페스타와 동남아 세포라 입점으로 현지 소비자를 만났다.", "세포라 입점 국가의 확대 여부와 모바일 피부 진단의 후속 활용.", kst("2026-10-12"), [601, 602]),
  sn(711, "musinsa", "해외 팝업과 오프라인 매장 행사로 소비자 접점을 넓히는 중", "최근 움직임은 매장과 현장을 향한다. 국내에서는 성수 협업 팝업과 온·오프라인 연계 할인 행사가 이어졌고, 해외에서는 상하이 팝업에 이어 오사카 대형 팝업이 발표됐다.", "오사카 팝업 개최 이후의 후속 계획과 매장 전용 혜택의 정례화 여부.", kst("2026-10-08", "10:28"), [611, 612]),
  sn(741, "danggeun", "동네모임 활동과 지역 사업자 연결 도구를 함께 넓히는 중", "최근 움직임은 이용자와 지역 사업자 양쪽을 향한다. 이용자 쪽에서는 동네모임 캠페인과 러닝 기록 기능이 더해졌고, 사업자 쪽에서는 매장 시스템 연동 제휴와 광고 MCP가 도입됐다.", "모임 기능의 다른 활동 확장과 토스플레이스 연동 매장의 비즈프로필 활용.", kst("2026-09-18"), [641, 642]),
]

// Recommended launch visibility, to be applied only at the Production Release Gate after approval.
// Public = evaluateEligibility public candidate; index = SEO candidate (≥ 3 distinct providers).
export const launchProfileRecommendations: { entity: Slug; publicStatus: "private" | "published"; seoStatus: "noindex" | "index"; rationale: string }[] = [
  { entity: "musinsa", publicStatus: "published", seoStatus: "index", rationale: "Snapshot + 4 recent Movements + 5 distinct providers" },
  { entity: "olive-young", publicStatus: "published", seoStatus: "noindex", rationale: "Snapshot + 5 recent Movements, but only 2 distinct providers" },
  { entity: "danggeun", publicStatus: "published", seoStatus: "noindex", rationale: "Snapshot + 5 recent Movements, but only 2 distinct providers" },
  { entity: "toss", publicStatus: "private", seoStatus: "noindex", rationale: "No Snapshot (one Pattern only)" },
  { entity: "baemin", publicStatus: "private", seoStatus: "noindex", rationale: "No Snapshot (one Pattern only)" },
]
