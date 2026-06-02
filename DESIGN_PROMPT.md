# MarkLens Homepage Design Prompt

## 브랜드 정보
- **서비스명:** MarkLens
- **슬로건:** Where Marketing Trends Become Action
- **설명:** 글로벌 마케팅 인사이트를 분석하여 왜 중요한지, 어떻게 적용할 수 있는지, 포트폴리오에 어떻게 녹여낼 수 있는지를 전달하는 마케팅 인사이트 플랫폼
- **타겟:** 대학생, 취준생, 주니어 마케터

---

## 디자인 시스템

### 레퍼런스
- **70% Linear** — 강한 타이포그래피, 미니멀, 프리미엄 SaaS 느낌, 깔끔한 여백
- **20% Notion** — 넓은 콘텐츠 영역, 뛰어난 가독성, 넉넉한 여백
- **10% Beehiiv** — 뉴스레터 아카이브 페이지에서만 카드형 레이아웃

### 컬러 팔레트
- Background: `#FFFFFF`
- Foreground: `#0A0A0A`
- Muted: `#F5F5F5`
- Muted Foreground: `#737373`
- Border: `#E5E5E5`
- Accent: `#F5F5F5`

> 컬러풀한 그라디언트, 화려한 색상 사용 금지. 오직 흑백과 뉴트럴 그레이만.

### 타이포그래피
- Font: Geist Sans (또는 Inter)
- Heading: `font-weight: 600`, `letter-spacing: -0.02em`
- Body: `font-size: 14-16px`, `line-height: 1.6-1.75`
- Label: `font-size: 11-12px`, `letter-spacing: 0.08em`, `text-transform: uppercase`

### 전체 느낌
> "Linear meets Notion for modern marketers"
> 
> 깔끔하고 프리미엄한 SaaS이면서도, 콘텐츠를 읽기 좋은 구조. AI 티 없이 사람이 운영하는 전문 마케팅 미디어처럼 보여야 함.

---

## 홈페이지 구조 (/)

### 1. Header (Sticky)
- 좌측: `MarkLens` 로고 (세미볼드, 15px)
- 중앙: 네비게이션 — 인사이트 / 케이스 라이브러리 / 뉴스레터 / 소개
- 우측: `구독하기` CTA 버튼 (검정 배경, 흰 텍스트, 소형)
- 배경: 반투명 blur 효과 (`backdrop-blur`)
- 하단에 얇은 border

---

### 2. Hero Section
레이아웃: 좌측 텍스트 정렬, 최대 너비 `2xl` 컨테이너

구성 요소:
1. **상단 배지** (pill 형태)
   - 초록 점(animate-pulse) + "매주 월요일 7:30 AM 발행"
   - border, rounded-full, 매우 작은 텍스트

2. **메인 헤딩** (h1)
   - "마케팅 트렌드를 읽고,"
   - "실무를 준비하다." (두 번째 줄은 muted color)
   - font-size: 48-56px, font-weight: 600, letter-spacing: -0.03em

3. **서브텍스트** (p)
   - "글로벌 마케팅 인사이트를 분석하여 왜 중요한지, 어떻게 적용할 수 있는지, 포트폴리오에 어떻게 녹여낼 수 있는지를 함께 전달합니다."
   - 18px, muted foreground, line-height: 1.7

4. **CTA 버튼 그룹**
   - Primary: "뉴스레터 구독하기 →" (검정 버튼)
   - Secondary: "인사이트 둘러보기" (border 버튼)

---

### 3. What MarkLens Offers (3-column)
구분선 위아래로 섹션 분리

- 상단 라벨: "MARKLENS가 제공하는 것" (uppercase, muted, tracking-widest)
- 3열 그리드:
  1. **글로벌 마케팅 인사이트** — HubSpot, Ahrefs 등 주요 미디어 큐레이션
  2. **실무 중심 분석** — 왜 중요한지, 어떻게 적용할지, 프레임워크 분석
  3. **포트폴리오 & 커리어** — 면접 활용법, 포트폴리오 활용 제안

---

### 4. Case Library Preview
- 상단: "케이스 라이브러리" 라벨 + "전체 보기 →" 링크
- 카테고리 태그 나열 (pill 형태 버튼들):
  브랜딩 / 퍼포먼스 마케팅 / SEO / 콘텐츠 마케팅 / 소셜 미디어 / AI 마케팅 / CRM / 소비자 심리

---

### 5. Newsletter CTA Section
- 라벨: "MARKLENS WEEKLY"
- 헤딩: "매주 월요일, 한 주를 시작하는 마케팅 브리핑"
- 설명: 5가지 섹션 소개 (This Week's Signals, Case of the Week 등)
- CTA: "무료 구독하기 →" 버튼

---

### 6. Footer
- 좌측: MarkLens 로고 + "Where Marketing Trends Become Action" 서브텍스트
- 중앙: 네비게이션 링크
- 우측: "© 2025 MarkLens"

---

## 컴포넌트 스타일 가이드

### 버튼
```
Primary: bg-black text-white px-5 py-2.5 rounded-md text-sm font-medium
Secondary: border border-gray-200 px-5 py-2.5 rounded-md text-sm font-medium
Ghost: text-gray-500 hover:text-black px-3 py-1.5 rounded-md text-sm
```

### 카드 (인사이트 카드)
```
border border-gray-200 rounded-lg p-5
hover: border-gray-400 transition-colors
내부: 배지 + 제목(2줄) + 요약(3줄) + 소스/날짜
```

### 구분선
```
border-t border-gray-100 (매우 연한 구분선으로 섹션 분리)
```

### 배지/태그
```
bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full
```

---

## 피해야 할 것
- ❌ 그라디언트 배경
- ❌ 화려한 색상 (파란색, 보라색 등)
- ❌ 과도한 그림자
- ❌ 정보 과밀 레이아웃
- ❌ "AI가 분석한", "자동 생성" 등의 표현
- ❌ 스톡 이미지, 일러스트

## 지향하는 것
- ✅ 넉넉한 여백 (padding/margin을 충분히)
- ✅ 강한 타이포그래피로 계층 표현
- ✅ 얇은 border로 요소 구분
- ✅ 호버 시 미세한 변화 (색상, border 등)
- ✅ 전문 에디터리얼 미디어 느낌
