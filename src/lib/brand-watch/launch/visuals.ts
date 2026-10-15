// Brand Watch visual evidence (display metadata, reviewed 2026-10-15; see docs/brand-watch-launch-source-pack.md).
// Each image is one the reviewed source page itself publishes for that event. Nothing is copied or stored:
// the image is linked from the page's own image host and always shown with its source. Matching is by the
// source's canonical URL, so an image can only appear when that source supports a published Movement.
// `checkedAt` and `note` are review notes for maintainers and never reach the public read model.

export type VisualOrigin = "official" | "newsroom" | "media"
export interface LaunchVisual {
  sourceUrl: string
  imageUrl: string
  alt: string // what the image shows as evidence, not "image" / "photo"
  origin: VisualOrigin // official = brand site/campaign page, newsroom = brand newsroom, media = outlet page
  credit: string // rights holder named on the page (media outlets carrying a company-provided image)
  fit?: "contain" // posters whose text would be cut by cropping are shown whole
  checkedAt: string
  note?: string
}

const CHECKED = "2026-10-15"
const OY = "https://d10yximrhdxai4.cloudfront.net/news/"
const DAANGN = "https://prismic-image-proxy.krrt.io/karrot/"
const DAANGN_SIZE = "?auto=compress%2Cformat&fit=max&q=90&w=1600"
const pr = (slug: string) => `https://about.daangn.com/company/pr/archive/${slug}/`

// Order matters: for a Movement with several public sources, the first usable entry is shown.
export const launchVisuals: readonly LaunchVisual[] = [
  // BAEMIN — every image is credited to 우아한형제들 on the outlet page.
  { sourceUrl: "https://biz.newdaily.co.kr/site/data/html/2026/10/07/2026100700056.html", imageUrl: "https://image.newdaily.co.kr/site/data/img/2026/10/07/2026100700056_0.jpg", alt: "보라색 컨테이너 매장 위 OFF BEAUTY 간판과 ‘배민장보기·쇼핑, 오프뷰티도 배민 돼요!’ 문구가 담긴 공식 홍보 이미지", origin: "media", credit: "우아한형제들", checkedAt: CHECKED, note: "caption: ⓒ우아한형제들" },
  { sourceUrl: "https://www.huffingtonpost.kr/article/260905", imageUrl: "https://cdn.huffingtonpost.kr/news/photo/202610/202610019032.jpg", alt: "포인트 코인 그래픽과 ‘새로워진 배민클럽 포인트가 쌓인다’ 문구가 담긴 배민클럽 에디션2 공식 홍보 이미지", origin: "media", credit: "우아한형제들", checkedAt: CHECKED, note: "caption: ⓒ우아한형제들" },
  { sourceUrl: "https://www.newspim.com/news/view/20260901000131", imageUrl: "https://img.newspim.com/news/2026/09/01/2609010845355090.jpg", alt: "배민클럽 로고 이미지", origin: "media", credit: "우아한형제들", checkedAt: CHECKED, note: "caption: [사진=우아한형제들]; announcement-stage source, superseded in the correction scenario" },
  { sourceUrl: "https://www.pointdaily.co.kr/news/articleView.html?idxno=320426", imageUrl: "https://cdn.pointdaily.co.kr/news/photo/202609/320426_316986_3526.jpg", alt: "서울마이소울 × 배달의민족 ‘9월말 투아웃! 9월에는 함께 홈을 떠나요’ 픽업 캠페인 포스터", origin: "media", credit: "우아한형제들", fit: "contain", checkedAt: CHECKED, note: "caption: 사진=우아한형제들" },

  // MUSINSA
  { sourceUrl: "https://www.musinsa.com/content/1528923777154874918", imageUrl: "https://image.msscdn.net/cms/v2/content/file_1784695467996_5718400_7zp5lg.jpg", alt: "MUSINSA 간판이 걸린 성수 거리 앞에 선 로블록스 아바타들 — 무신사 × 로블록스 팝업 키 비주얼", origin: "official", credit: "무신사", checkedAt: CHECKED, note: "og:image of the official campaign page" },
  { sourceUrl: "https://www.newspim.com/news/view/20261008000081", imageUrl: "https://img.newspim.com/news/2026/10/08/2610080823533560.jpg", alt: "네온 ‘ON OFF’ 글자와 ‘온&오프 페스티벌 2026.10.06 - 10.19’ 문구가 담긴 무신사 공식 포스터", origin: "media", credit: "무신사", checkedAt: CHECKED, note: "caption: [사진=무신사 제공]" },
  { sourceUrl: "https://www.sedaily.com/article/20095452", imageUrl: "https://wimg.sedaily.com/news/cms/2026/09/28/news-p.v1.20260928.9f7306f77e67483e9204dad259f646fc_P1.jpg", alt: "MUSINSA 간판이 걸린 무신사 상하이 팝업 스토어 2026 입구와 매장 내부", origin: "media", credit: "무신사", checkedAt: CHECKED, note: "caption: 사진 제공=무신사" },
  { sourceUrl: "https://m.inews24.com/v/2006389", imageUrl: "https://image.inews24.com/v1/b59f73c46f9d75.jpg", alt: "‘MUSINSA → OSAKA POP-UP STORE 2026’ 키 비주얼", origin: "media", credit: "무신사", checkedAt: CHECKED, note: "caption: [사진=무신사]" },

  // OLIVE YOUNG — official newsroom images (page og:image).
  { sourceUrl: "https://corp.oliveyoung.com/ko/newsroom/press/288", imageUrl: `${OY}73306343d0a341f78b10dddfc90a5484.jpg`, alt: "싱가포르 쇼핑몰에 마련된 초록색 ‘OLIVE YOUNG K-Beauty Edit’ 팝업 매대와 세포라 × 올리브영 표기", origin: "newsroom", credit: "CJ올리브영", checkedAt: CHECKED },
  { sourceUrl: "https://corp.oliveyoung.com/ko/newsroom/press/232", imageUrl: `${OY}7ee0ff6a3bd94b598114fe65e89f7728.jpg`, alt: "‘SKIN SCAN’ 로고와 얼굴 촬영·피부 분석 화면을 띄운 스마트폰 두 대 — 올리브영 모바일 피부 진단 공식 이미지", origin: "newsroom", credit: "CJ올리브영", checkedAt: CHECKED },
  { sourceUrl: "https://corp.oliveyoung.com/ko/newsroom/press/138", imageUrl: `${OY}43d2f77836cf42449464f954b02af840.jpg`, alt: "밤의 도시 횡단보도를 건너는 산리오캐릭터즈와 ‘OLIVE YOUNG City Log’ 로고 — 컬래버 대표 이미지", origin: "newsroom", credit: "CJ올리브영", checkedAt: CHECKED },
  { sourceUrl: "https://corp.oliveyoung.com/ko/newsroom/press/141", imageUrl: `${OY}27cb8a50549f49209ac751b2f393f028.jpg`, alt: "지역 헬로키티 디자인이 적용된 올리브영 매장 전경 투시도", origin: "newsroom", credit: "CJ올리브영", checkedAt: CHECKED },
  { sourceUrl: "https://corp.oliveyoung.com/ko/newsroom/press/140", imageUrl: `${OY}f0f1c702d66844a5b849499a9fe98113.jpg`, alt: "초록 조명이 켜진 부산 ‘OLIVE YOUNG TOWN’ 매장 건물 야간 외관", origin: "newsroom", credit: "CJ올리브영", checkedAt: CHECKED },
  { sourceUrl: "https://corp.oliveyoung.com/ko/newsroom/press/137", imageUrl: `${OY}73f6491c44454fd796b43f25271df636.jpg`, alt: "관람객으로 붐비는 ‘OLIVE YOUNG FESTA’ LA 행사장 전경", origin: "newsroom", credit: "CJ올리브영", checkedAt: CHECKED },

  // TOSS — in-article newsroom images (the page og:image is a generic site image, so it is not used).
  { sourceUrl: "https://toss.im/newsroom/apps-in-toss-10000", imageUrl: "https://static.toss.im/photos/miniapp-10000.png", alt: "나란히 선 미니앱 아이콘들 — ‘앱인토스’ 미니앱 1만 개 공식 이미지", origin: "newsroom", credit: "토스", checkedAt: CHECKED },
  { sourceUrl: "https://toss.im/newsroom/toss-new-homepage", imageUrl: "https://static.toss.im/photos/toss-new-homepage.png", alt: "일상 속 토스 사용 장면 사진들을 모은 홈페이지 개편 공식 이미지", origin: "newsroom", credit: "토스", checkedAt: CHECKED },
  { sourceUrl: "https://toss.im/newsroom/toss-prepaid-card-international-students", imageUrl: "https://static.toss.im/disposables/photos/toss-visitor-student.png", alt: "손을 흔드는 세 사람 일러스트와 ‘Toss Prepaid Card’ 카드 세 장 — 외국인 유학생 선불카드 공식 이미지", origin: "newsroom", credit: "토스", checkedAt: CHECKED },
  // Not used: byline.network (0923-5) only carries the outlet's own photo of a conference speaker, which does not show the move.

  // DANGGEUN — official press release images.
  { sourceUrl: pr("당근-연중-최대-중고거래의-날-당근절-개최"), imageUrl: `${DAANGN}95u9IHkOFVDENL2V_%5B%E1%84%8B%E1%85%B5%E1%84%86%E1%85%B5%E1%84%8C%E1%85%B51%5D%E1%84%83%E1%85%A1%E1%86%BC%E1%84%80%E1%85%B3%E1%86%AB%2C%E1%84%8B%E1%85%A7%E1%86%AB%E1%84%8C%E1%85%AE%E1%86%BC%E1%84%8E%E1%85%AC%E1%84%83%E1%85%A2%E1%84%8C%E1%85%AE%E1%86%BC%E1%84%80%E1%85%A9%E1%84%80%E1%85%A5%E1%84%85%E1%85%A2%E1%84%8B%E1%85%B4%E1%84%82%E1%85%A1%E1%86%AF%E2%80%98%E1%84%83%E1%85%A1%E1%86%BC%E1%84%80%E1%85%B3%E1%86%AB%E1%84%8C%E1%85%A5%E1%86%AF%E2%80%99%E1%84%80%E1%85%A2%E1%84%8E%E1%85%AC.png${DAANGN_SIZE}`, alt: "‘바로구매’ 상자를 든 당근 캐릭터와 ‘연중 최대 중고거래의 날 당근절 — 10월 10일 바로구매 배송비 0원’ 문구가 담긴 공식 키 비주얼", origin: "newsroom", credit: "당근", checkedAt: CHECKED },
  { sourceUrl: pr("당근모임-러닝-기록-꾸미기-기능-출시"), imageUrl: `${DAANGN}epOkt0amcXvxeMbP_%5B%E1%84%8B%E1%85%B5%E1%84%86%E1%85%B5%E1%84%8C%E1%85%B51%5D%E1%84%83%E1%85%A1%E1%86%BC%E1%84%80%E1%85%B3%E1%86%AB%E1%84%86%E1%85%A9%E1%84%8B%E1%85%B5%E1%86%B7%2C%E2%80%98%E1%84%85%E1%85%A5%E1%84%82%E1%85%B5%E1%86%BC%E1%84%80%E1%85%B5%E1%84%85%E1%85%A9%E1%86%A8%E1%84%81%E1%85%AE%E1%84%86%E1%85%B5%E1%84%80%E1%85%B5%E2%80%99%E1%84%80%E1%85%B5%E1%84%82%E1%85%B3%E1%86%BC%E1%84%8E%E1%85%AE%E1%86%AF%E1%84%89%E1%85%B5.jpg${DAANGN_SIZE}`, alt: "러닝 기록 꾸미기 템플릿과 챌린지 현황 앱 화면 — 당근모임 ‘러닝 기록 꾸미기’ 기능 출시 공식 이미지", origin: "newsroom", credit: "당근", checkedAt: CHECKED },
  { sourceUrl: pr("당근-국내-광고-플랫폼-최초로-광고-mcp-출시"), imageUrl: `${DAANGN}sniRsOGRwfycb1tu_%5B%E1%84%8B%E1%85%B5%E1%84%86%E1%85%B5%E1%84%8C%E1%85%B51%5D%E1%84%83%E1%85%A1%E1%86%BC%E1%84%80%E1%85%B3%E1%86%AB%2C%E1%84%80%E1%85%AE%E1%86%A8%E1%84%82%E1%85%A2%E1%84%80%E1%85%AA%E1%86%BC%E1%84%80%E1%85%A9%E1%84%91%E1%85%B3%E1%86%AF%E1%84%85%E1%85%A2%E1%86%BA%E1%84%91%E1%85%A9%E1%86%B7%E1%84%8E%E1%85%AC%E1%84%8E%E1%85%A9%E1%84%85%E1%85%A9%E2%80%98%E1%84%80%E1%85%AA%E1%86%BC%E1%84%80%E1%85%A9MCP%E2%80%99%E1%84%8E%E1%85%AE%E1%86%AF%E1%84%89%E1%85%B5.jpg${DAANGN_SIZE}`, alt: "광고 데이터 조회 연결 화면과 캠페인 성과 표 — ‘당근 광고 MCP 출시’ 공식 이미지", origin: "newsroom", credit: "당근", checkedAt: CHECKED },
  { sourceUrl: pr("당근-기후에너지환경부-한국환경보전원과-지구를-위한-동네모임-캠페인-진행"), imageUrl: `${DAANGN}HizG438E-lHyQWD0_%5B%E1%84%8B%E1%85%B5%E1%84%86%E1%85%B5%E1%84%8C%E1%85%B51%5D%E1%84%83%E1%85%A1%E1%86%BC%E1%84%80%E1%85%B3%E1%86%AB%2C%E1%84%80%E1%85%B5%E1%84%92%E1%85%AE%E1%84%8B%E1%85%A6%E1%84%82%E1%85%A5%E1%84%8C%E1%85%B5%E1%84%92%E1%85%AA%E1%86%AB%E1%84%80%E1%85%A7%E1%86%BC%E1%84%87%E1%85%AE%C2%B7%E1%84%92%E1%85%A1%E1%86%AB%E1%84%80%E1%85%AE%E1%86%A8%E1%84%92%E1%85%AA%E1%86%AB%E1%84%80%E1%85%A7%E1%86%BC%E1%84%87%E1%85%A9%E1%84%8C%E1%85%A5%E1%86%AB%E1%84%8B%E1%85%AF%E1%86%AB%E1%84%80%E1%85%AA%E2%80%98%E1%84%8C%E1%85%B5%E1%84%80%E1%85%AE%E1%84%85%E1%85%B3%E1%86%AF%E1%84%8B%E1%85%B1%E1%84%92%E1%85%A1%E1%86%AB%E1%84%83%E1%85%A9%E1%86%BC%E1%84%82%E1%85%A6%E1%84%86%E1%85%A9%E1%84%8B%E1%85%B5%E1%86%B7%E2%80%99%E1%84%8F%E1%85%A2%E1%86%B7%E1%84%91%E1%85%A6%E1%84%8B%E1%85%B5%E1%86%AB%E1%84%8C%E1%85%B5%E1%86%AB%E1%84%92%E1%85%A2%E1%86%BC.jpg${DAANGN_SIZE}`, alt: "지구 위를 달리는 사람들 일러스트와 ‘#지구를위한동네모임 모임에서 지구 지키고 최대 100만원 받아요’ 캠페인 포스터", origin: "newsroom", credit: "당근", checkedAt: CHECKED },
  { sourceUrl: pr("당근-전국-40만-토스-가맹점-품는다홍보주문결제-하나로"), imageUrl: `${DAANGN}EBZv5Y1W0yvgow_M_%5B%E1%84%8B%E1%85%B5%E1%84%86%E1%85%B5%E1%84%8C%E1%85%B51%5D.jpg${DAANGN_SIZE}`, alt: "당근과 토스플레이스의 전략적 업무 제휴(MOU) 체결식 사진", origin: "newsroom", credit: "당근", checkedAt: CHECKED },
]
