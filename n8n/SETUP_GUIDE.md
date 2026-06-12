# n8n 설정 가이드

---

## Step 0 — n8n Cloud 계정 생성

1. https://n8n.io 접속
2. **Get started for free** 클릭
3. 이메일로 회원가입 (Google 계정 로그인 가능)
4. 플랜 선택 → **Free** 플랜으로 시작 (월 2,500회 실행, 충분함)
5. 인스턴스 이름 입력 → 예: `marklens`
6. 대시보드 진입 확인

---

## Step 1 — 임포트 파일 생성 (시크릿 주입)

repo의 `n8n/*.json`은 시크릿이 `__N8N_WEBHOOK_SECRET__` 플레이스홀더로 비워진 **템플릿**이다.
실제 값(.env.local의 `N8N_WEBHOOK_SECRET`)을 끼운 임포트용 파일을 로컬에서 생성:

```bash
node scripts/build-n8n-workflows.mjs
# → n8n/dist/*.json 생성 (gitignore — 절대 커밋 금지)
```

> ⚠️ 시크릿 값은 Vercel 환경변수 `N8N_WEBHOOK_SECRET`과 반드시 일치해야 한다.
> 시크릿 교체 시 순서: ① Vercel 환경변수 변경 + 재배포 → ② .env.local 갱신 → ③ 이 스크립트 재실행 → ④ n8n 재임포트.

---

## Step 2 — 워크플로우 임포트

### 워크플로우 1: RSS 수집 & AI 분석

1. n8n → **Workflows** → **Add Workflow** → 우측 상단 `...` → **Import from file**
2. **`n8n/dist/workflow-collect.json`** 파일 선택 (dist 폴더의 것!)
3. 임포트 후 **Active** 토글 켜기

### 워크플로우 2: 뉴스레터 자동 생성

1. 동일한 방법으로 **`n8n/dist/workflow-newsletter.json`** 임포트
2. **Active** 토글 켜기

> 기존에 같은 이름의 워크플로가 있으면 먼저 비활성화/삭제 후 임포트 (중복 실행 방지).

---

## Step 3 — 테스트

### RSS 수집 테스트
1. workflow-collect 열기
2. **Test workflow** 클릭
3. 결과에서 `collected: N` 확인

### AI 분석 테스트
1. 수집 후 `analyze-pending` 노드가 실행됐는지 확인
2. MarkLens 관리자 패널(`/admin/articles`)에서 "준비 완료" 아티클 확인

---

## 자동화 흐름 요약

```
[매일 09:00, 18:00]
    ↓
RSS 피드 수집 (7개 소스)
    ↓
새 아티클 DB 저장
    ↓ (새 아티클 있을 때만)
AI 분석 실행 (Claude + GPT-4o)
    ↓
status: "ready" → 관리자 승인 대기

[매주 월요일 07:30]
    ↓
뉴스레터 초안 자동 생성 (Claude)
    ↓
status: "draft" → 관리자 검토 후 발행
```

---

## 로컬 테스트 (배포 전)

Vercel 배포 전 로컬에서 테스트하려면:

1. ngrok 설치: `npm install -g ngrok`
2. 터널 생성: `ngrok http 3000`
3. n8n 워크플로의 HTTP 노드 URL(`https://marklens.site/...`)을 ngrok URL로 임시 수정
4. 테스트 후 다시 원래 URL로 복원
