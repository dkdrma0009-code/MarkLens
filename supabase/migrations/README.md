# MarkLens DB 마이그레이션

Supabase는 마이그레이션 CLI 없이 **대시보드 → SQL Editor에 직접 붙여넣어 실행**하는 방식으로 운영한다.
새 DB를 처음부터 구축하거나 재현할 때는 **아래 번호 순서대로** 각 파일을 실행한다.

| 순서 | 파일 | 목적 | 의존 |
|---|---|---|---|
| 001 | `001_schema.sql` | 기반 테이블 (articles, insights, categories, newsletter_issues, subscribers, rss_sources, analytics_events) + 기본 grant | — |
| 002 | `002_newsletter_redesign.sql` | newsletter_issues에 "한 주제 깊이형" 컬럼 추가 (topic_headline, body_sections 등) | 001 |
| 003 | `003_newsletter_events.sql` | newsletter_events 테이블 — Brevo 웹훅이 오픈/클릭 기록 | 001 |
| 004 | `004_insight_lab.sql` | 인사이트 랩 테이블 (insight_challenges/sessions/notes/user_stats) + RLS + 샘플 챌린지 | — |
| 005 | `005_grants.sql` | public 스키마 전체 GRANT ALL (PostgREST 접근용) | 001~004 (모든 테이블 생성 후) |
| 006 | `006_grants_tighten.sql` | anon/authenticated 권한을 최소 집합으로 축소 (005를 덮어씀) | **반드시 005 이후** |
| 007 | `007_newsletter_approved_at.sql` | newsletter_issues.approved_at 추가 (코드가 기대하나 누락됐던 컬럼 — 발송 후 상태 업데이트·승인 워크플로용) | 001 |
| 008 | `008_subscriber_drip.sql` | subscribers.drip_step 추가 (온보딩 드립 시퀀스 진행 추적). 기존 활성 구독자는 99로 세팅해 드립 제외 | 001 |

## 주의

- **005 → 006 순서 필수**: 005가 광범위하게 GRANT ALL 한 뒤, 006이 anon/authenticated만 최소 권한으로 좁힌다. 005 없이 006만 돌리면 의도와 다르게 동작한다.
- **005/006은 마지막에**: 전체 스키마 GRANT 스윕이라 모든 테이블(001~004)이 존재한 상태에서 실행해야 누락이 없다.
- 각 파일은 `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` 기반이라 **재실행해도 안전**하다(idempotent).
- 운영 DB(ref: ndehtnchkgvpjbxlkazk)에는 001~006이 모두 적용 완료된 상태다. 이 폴더는 재구축·문서화용 기준이다.

## archive/

`../archive/newsletter-body-image.sql` — **폐기됨.** 2단계 Unsplash 전용 방식에서 쓰던 컬럼으로,
3단계(섹션별 visual) 전환 후 `body_sections[].visual.photo`로 대체됨. 실행하지 말 것. 이력 참고용으로만 보관.
