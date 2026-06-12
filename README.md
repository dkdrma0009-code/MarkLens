# MarkLens

**marklens.site** — 글로벌 마케팅 트렌드를 분석해 실무에 바로 적용 가능한 인사이트로 전달하는 서비스.
RSS 수집 → AI 분석 → 발행 → 뉴스레터/카드뉴스/광고 영상까지 이어지는 콘텐츠 파이프라인을 갖추고 있다.

## 기술 스택

- **Next.js (App Router)** + TypeScript + Tailwind CSS — ⚠️ 이 repo의 Next.js는 학습 데이터와 다를 수 있음. 코드 작성 전 `node_modules/next/dist/docs/` 가이드 확인 ([AGENTS.md](AGENTS.md))
- **Supabase** — DB(articles/insights/subscribers 등) + Storage(`ad-assets` 버킷) + Auth(관리자)
- **AI**: Gemini(분석/퀴즈/채팅), Anthropic/OpenAI(폴백), Veo 3.1(광고 영상 생성)
- **Satori(next/og)** — 카드뉴스·광고 오버레이·엔드카드·OG 이미지 렌더 (폰트: `assets/fonts/` Pretendard + Playfair)
- **Brevo** — 뉴스레터 발송 / **GA4** — 분석 / **Vercel** — 배포(cron 포함)

## 주요 기능

### 공개 페이지
| 경로 | 내용 |
|---|---|
| `/insights` | 마케팅 인사이트 목록 (카테고리 필터) |
| `/insights/[slug]` | 인사이트 상세 (동적 OG 이미지) |
| `/library` | 브랜드 캠페인 사례 라이브러리 |
| `/newsletter` | 주간 뉴스레터 구독 |
| `/interview` | AI 모의면접 (STT 실시간 자막, 답변 피드백) |
| `/learn` | 마케팅 트렌드 퀴즈 |
| `/about`, `/feedback` | 소개 / 사이트 피드백 |

### 어드민 (`/admin`, ADMIN_EMAIL 계정만)
아티클 수집·분석·발행, 카드뉴스 생성(Satori), 광고 패키징(adkit: 오버레이/엔드카드 + 제품 이미지 업로드), 뉴스레터 생성·발송, 구독자/소스/분석/피드백 관리.

## 광고 제작 파이프라인

영상 생성(Veo) → 조립(ffmpeg) 2단 구조. 상세 스펙: [docs/marklens-ad-generation-spec.md](docs/marklens-ad-generation-spec.md)

```bash
# 1) 클립 생성 — Veo 3.1 fast API (샷리스트: ad-meteor/shotlist.md)
pip install google-genai
python ad-meteor/generate_clips.py --out ad-work/meteor              # 전체 샷
python ad-meteor/generate_clips.py --shot S5 --image .../can.png    # 단일/이미지 참조

# 2) 조립 — config 기반 트림/줌/트랜지션/그레이드/오디오/엔드카드
node scripts/assemble-ad.mjs scripts/ad2-config.json
```

- `scripts/assemble-ad.mjs` — xfade 체인(프레임 양자화), 펀치인 줌, keepClipAudio(원본 오디오 크로스페이드+음악 amix), 스틸 이미지 클립, 엔드카드
- `ad-work/`(영상 소재)는 gitignore — 컴퓨터 간 공유 안 됨. ffmpeg는 로컬 설치 필요 (Windows: `C:\bin\ffmpeg.exe`)

## 개발

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

### 환경변수 (`.env.local` — git 미추적, 컴퓨터 간 수동 복사 필요)

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 어드민 클라이언트 (createAdminClient) |
| `ADMIN_EMAIL` | 어드민 접근 허용 계정 |
| `GEMINI_API_KEY` | 분석·퀴즈·채팅 (필수) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | LLM 폴백 (선택) |
| `VEO_API_KEY` | Veo 영상 생성 (generate_clips.py) |
| `BREVO_API_KEY` | 뉴스레터 발송 |
| `YOUTUBE_API_KEY` | 분석 보조 (선택) |
| `N8N_WEBHOOK_SECRET` | 웹훅/서버사이드 미리보기 인증 |
| `CRON_SECRET` | Vercel cron 인증 |
| `NEXT_PUBLIC_SITE_URL` | 절대 URL 생성 (sitemap/메일 링크) |
| `NEXT_PUBLIC_GA_ID` | GA4 (미설정 시 기본값 폴백) |

## 구조 메모

- `src/app/(public)/` 공개 페이지 · `src/app/admin/` 어드민 · `src/app/api/` API 37개+ (cron/webhooks 포함)
- `src/lib/cardnews/` Satori 렌더 유틸 (이미지 fetch + 픽셀 크기 파싱 — Satori는 `backgroundSize: contain` 미지원이라 서버에서 박스 계산)
- `src/lib/shorts/templates.tsx` 광고 오버레이/엔드카드 템플릿
- Satori 라우트에서 로컬 폰트를 쓰면 `next.config.ts`의 `outputFileTracingIncludes`에 해당 라우트 추가 필요
- 작업 규칙·프롬프트 패턴 등 누적 지식은 `docs/` 참고 — repo 문서가 여러 작업 환경(컴퓨터) 간 공유되는 유일한 컨텍스트다
