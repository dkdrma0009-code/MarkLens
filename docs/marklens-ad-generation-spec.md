# MarkLens AI 광고 자동화 시스템 — 구현 스펙 v1

> 작성: 2026-06-11 (Day 1 실험 데이터 기반)
> 목표: 어드민에서 "제품 이미지 1장 + 콘셉트 선택 → 검수 가능한 광고 후보"까지 자동화
> 6/30 이후 운영자(승현) 혼자 굴릴 수 있는 구조가 최종 기준

---

## 0. 설계 원칙

1. **사람은 결정만, 기계는 반복을** — 콘셉트 선택·베스트 컷 확정·발행 버튼만 사람 몫
2. **실험에서 검증된 것만 코드화** — 프롬프트 규칙은 노션 실험 로그에서 옮겨온다 (추측 금지)
3. **고정비 0 우선** — Shotstack 대신 ffmpeg 경로 우선 검토 (월 $49 절약)
4. **만료 자원 독립** — Gemini Pro 구독(9/10 만료)과 무관하게 API 종량제로 동작

---

## 1. 파이프라인 개요

```
[어드민 입력]
  제품 이미지 업로드 + 제품명 + 콘셉트 선택(빙결 임팩트/여정형/매크로/커스텀)
       ↓
① 프롬프트 생성  (LLM — geminiJson 재사용)
  프롬프트 규칙 라이브러리(§4)를 시스템 프롬프트로, 콘셉트별 샷 구조 명시
       ↓
② Veo API 변주 생성  (N개, 기본 4 — veo-3.1-fast)
  비동기 long-running → 잡 테이블에 기록, 폴링으로 수거
       ↓
③ 자동 채점  (Gemini 비전)
  각 영상에서 프레임 3장 추출(시작/중간/끝) → 라벨 생존·구도·아티팩트 채점
       ↓
④ 어드민 검수 그리드
  후보 N개 + 점수 표시 → 운영자가 베스트 선택 (+필요시 추가 변주 요청)
       ↓
⑤ 조립  (ffmpeg)
  선택 클립 스티칭 + 오버레이 PNG(기존 adkit) + 엔드카드 + 음악 → 9:16 mp4
       ↓
⑥ 산출물
  완성 mp4 다운로드 + 캡션 자동 생성(기존 캡션 엔진 변형)
```

**재사용 자산**: geminiJson(LLM), adkit 오버레이·엔드카드 템플릿, 캡션 생성기, 어드민 UI 패턴(카드뉴스 스튜디오), rate-limit
**신규 구축**: Veo API 클라이언트, 잡 테이블·폴링, 프레임 채점, ffmpeg 조립

---

## 2. 데이터 모델 (Supabase)

```sql
CREATE TABLE IF NOT EXISTS ad_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,                  -- "얼박사 빙결 리빌"
  product_name text,
  product_image_url text,               -- 업로드된 제품컷 (Supabase Storage)
  concept text NOT NULL,                -- ice_burst | journey | macro | custom
  status text NOT NULL DEFAULT 'draft', -- draft|generating|review|assembling|done
  brief jsonb,                          -- 생성된 샷 구조·프롬프트들
  caption text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ad_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES ad_projects(id) ON DELETE CASCADE,
  shot_index int NOT NULL DEFAULT 0,    -- 여정형 멀티샷 대비
  prompt text NOT NULL,
  veo_operation text,                   -- long-running operation name (폴링 키)
  video_url text,                       -- 완료 후 저장 위치 (Supabase Storage)
  score jsonb,                          -- {label: 0-10, composition: 0-10, artifacts: [...], total}
  status text NOT NULL DEFAULT 'queued',-- queued|generating|scoring|ready|failed|selected
  created_at timestamptz DEFAULT now()
);
```

영상 저장: Veo 응답(파일 URI)은 만료되므로 **Supabase Storage 버킷 `ad-clips`로 즉시 복사**.

---

## 3. Veo API 클라이언트 (`src/lib/ads/veo.ts`)

- 키: `VEO_API_KEY` (사이트 LLM 키와 분리 — 과금 격리)
- 엔드포인트 (Gemini API video):
  - 생성: `POST /v1beta/models/{model}:predictLongRunning` — `instances[{prompt, image{bytesBase64Encoded}}]`, `parameters{aspectRatio: "9:16", ...}`
  - 폴링: `GET /v1beta/{operation.name}` → `done` 시 `response.generateVideoResponse.generatedSamples[].video.uri`
  - ⚠️ **첫 호출 때 실제 스키마 검증 필수** (필드명이 문서 버전마다 다름 — 구현 시 1회 수동 테스트로 고정)
- 모델: 변주 `veo-3.1-fast-generate-preview`, 최종 고품질 `veo-3.1-generate-preview`
- 타임아웃: 생성 1~3분 — Vercel 라우트에서 동기 대기 금지 → **잡 등록 후 즉시 반환, 폴링 분리**

### 폴링 전략
- `POST /api/admin/ads/poll` — ad_clips의 `generating` 상태를 일괄 폴링 (n8n 1분 주기 or 어드민 페이지 폴링)
- 완료 → 영상 다운로드 → Storage 업로드 → status `scoring` → 채점 트리거

---

## 4. 프롬프트 규칙 라이브러리 (Day 1 검증분)

시스템 프롬프트에 박을 **확정 규칙**:

```
[카메라] 정면 유지 계열만 (static, push-in, dolly-in). orbit·회전 금지 — 참조에 없는 면 = 라벨 환각
[클로즈업] 1~2초 비트 전용. 길면 정지 상태에서도 텍스트 시간붕괴
[라벨] "The product stays perfectly sharp with its label facing the camera" 필수.
       정확한 라벨이 필요한 컷은 생성하지 않는다 — 엔드카드(실제 제품컷)가 담당
[조명] "electric/glow/neon" 금지 → "cool/warm soft studio lighting" 계열 (후광 아티팩트 방지)
[구도] 제품 고정 + 주변만 액션 = 라벨 생존 최적. 제품 기울임 금지
[콘셉트 고정] 샷 구조를 프롬프트에 명시 ("starts frozen inside ice, then bursts out")
[연장] 연장 프롬프트에 제품 묘사 반복 ("blue can with silver bottom") = 드리프트 앵커
[오클루전] 라벨 불안 구간은 서리·스플래시로 가리기 (드리프트 마스킹)
[텍스트] 고대비 인쇄체만 생존 후보. 음각·양각·저대비·곡선 장식체는 뭉개짐 전제
```

### 콘셉트 템플릿 (brief 생성용)
| 콘셉트 | 샷 구조 | 검증 상태 |
|---|---|---|
| `ice_burst` | 빙결 리빌 → 탈출 히어로 → 재결빙 엔드 (3샷) | ✅ Day 1, 22초 실증 |
| `macro` | 콘덴세이션 클로즈업 비트 (1~2초 컷용) | ✅ Day 1 |
| `journey` | 라벨 없는 주인공 오브젝트가 장면들 관통 → 제품 착지 | ✅ Day 2 (얼음 결정 샷1~2: 참조 재첨부로 동일 주인공 유지 확인) |
| `luxury` | 정면 고정 + 실크/파티클 (저대비 로고 제품용) | ✅ Day 1 (구찌) |

> 갱신 절차: 노션 실험 로그의 "확정 패턴"이 늘면 이 섹션과 `src/lib/ads/prompts.ts`를 함께 갱신

---

## 5. 자동 채점 (`src/lib/ads/score.ts`)

- 입력: 영상에서 프레임 3장 (ffmpeg `-ss` 추출: 0.5s / 중간 / 끝-0.5s)
- Gemini 비전(gemini-3-pro-image 아님 — **텍스트+이미지 입력 모델** gemini-2.5-flash)에 3장 + 기준 제품컷 전달:

```json
{
  "label_fidelity": 0-10,   // 기준 제품컷 대비 로고·색·형태 일치
  "composition": 0-10,      // 광고 구도 (중앙성, 임팩트, 조명)
  "artifacts": ["..."],     // 후광, 왜곡, 잘림 등 발견 항목
  "best_frame": 1|2|3,
  "verdict": "usable|review|reject"
}
```

- 채점 기준 문구는 **운영자의 노션 별점 코멘트에서 추출** (주관 기준의 코드화)
- total = label*0.5 + composition*0.5, artifacts 매 건 -1

---

## 6. 조립 (`src/lib/ads/assemble.ts`)

**경로 결정: ffmpeg 우선, Shotstack 폴백**

- ffmpeg 실행 위치: Vercel 함수는 바이너리 제약 → **1차: 로컬 CLI 스크립트** (`scripts/assemble-ad.mjs`) — 어드민에서 "조립 명령 복사" 제공, 운영자가 로컬 실행
  - 입력: 선택 클립 mp4들 + 오버레이 PNG + 엔드카드 PNG + 음악 mp3
  - 처리: concat → overlay(전구간) → 엔드카드(마지막 2.5s) → aac 음악 → 1080×1920 mp4
- 2차(여유 시): Shotstack stage로 클라우드 조립 검증 → 발행량 늘면 유료 전환 판단
- 음악: 유튜브 오디오 라이브러리 무료 트랙 3~5개를 `assets/music/`에 큐레이션

---

## 7. 어드민 UI (`/admin/ads`)

카드뉴스 스튜디오 패턴 복제:

1. **프로젝트 목록** — 상태 배지 (생성중 N/4, 검수 대기, 완료)
2. **새 광고** — 제품 이미지 업로드(Storage) + 제품명 + 콘셉트 선택 + [브리프 생성]
3. **브리프 검수** — 생성된 샷 프롬프트 편집 가능 → [영상 생성 시작] (변주 수 선택 2/4/6)
4. **후보 그리드** — 영상 플레이어 + 채점 결과 + [선택] / [이 프롬프트로 재생성]
5. **조립** — 오버레이 문구 입력(adkit 연동) + 음악 선택 → 로컬 조립 명령 복사 (or Shotstack 실행)
6. **마무리** — 캡션 자동 생성 + 노션 기록용 요약 복사

---

## 8. 비용 가드레일

- 프로젝트당 기본 변주 4개 (fast) ≈ $5 — 어드민에 누적 비용 표시 (clips × 단가 추정)
- 일일 생성 상한: 환경변수 `ADS_DAILY_LIMIT` (기본 12클립) — 폭주 방지
- 최종 고품질 재생성은 명시적 버튼으로만 (자동 금지)

---

## 9. 구현 순서 (스프린트: ~6/17)

1. SQL 2테이블 + Storage 버킷 `ad-clips`, `ad-assets` (사용자 1회)
2. `veo.ts` 클라이언트 + 생성/폴링 라우트 — **첫 실호출로 스키마 고정** ← 빌링 선행
3. 채점 (`score.ts` + 라우트)
4. 어드민 `/admin/ads` (목록→생성→검수)
5. 조립 스크립트 + adkit 연동
6. E2E: 얼박사 1편을 시스템으로 재생산 → 손으로 만든 1호와 비교

## 10. 미결정·확인 필요

- [ ] Veo API 실제 요청/응답 스키마 (빌링 후 1회 호출로 고정)
- [x] journey 콘셉트 검증 (Day 2, 2026-06-11) — 샷1(횡단보도)·샷2(지하철 입구)에서 동일 결정 유지 확인
- [x] 멀티샷 주인공 일관성 전략 = **동일 참조 이미지를 전 샷에 재첨부** (프레임 체이닝 불필요). 추가 규칙: 계절·날씨는 의상/땀/아지랑이로 노골적 명시 (여름+얼음 → 겨울 견인 사례), x2 변주가 분위기 가챠 보험
- [ ] 음악 트랙 큐레이션 (저작권 무료 3~5곡)
