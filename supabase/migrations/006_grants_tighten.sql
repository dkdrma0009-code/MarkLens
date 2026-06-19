-- =============================================================================
-- supabase/migrations/006_grants_tighten.sql
--
-- 목적   : anon / authenticated 롤 권한을 최소 집합으로 좁힌다.
--          (service_role은 변경 없음 — 이 파일에서 건드리지 않는다.)
--
-- 적용   : Supabase 대시보드 → SQL Editor에 전체 붙여넣기 후 실행
-- 시점   : 트래픽이 적은 시간대 권장 (새벽 ~ 오전)
-- 전제   : 이 SQL은 005_grants.sql 의 GRANT ALL 효과를 덮어쓴다. 반드시 그 뒤에 실행.
--          005_grants.sql 자체는 수정하지 않는다.
--
-- 작성   : 2026-06-17
-- =============================================================================


-- =============================================================================
-- [ROLLBACK] 이 파일 적용 후 사고 발생 시 아래 블록을 SQL Editor에 붙여넣어 복구
-- =============================================================================
--
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT ALL ON TABLES TO anon, authenticated;
--
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT ALL ON SEQUENCES TO anon, authenticated;
--
-- GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- STEP A : DEFAULT PRIVILEGES 회수
--
-- grants.sql 의 ALTER DEFAULT PRIVILEGES 로 인해 신규 테이블 생성 시
-- anon / authenticated 에 자동으로 GRANT ALL 이 부여되는 상태를 해제한다.
-- 이후 새 테이블은 명시적 GRANT 전까지 두 롤에 비공개 상태가 기본값이 된다.
-- (SQL Editor 실행 주체가 postgres 일 때 grants.sql 설정과 대칭적으로 동작한다.)
-- -----------------------------------------------------------------------------

-- 테이블 기본 권한 회수
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

-- 시퀀스 기본 권한 회수 (serial / identity PK 테이블의 자동 노출 방지)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;


-- -----------------------------------------------------------------------------
-- STEP B : 현재 존재하는 모든 테이블 / 시퀀스 권한 전체 회수
--
-- STEP A 는 미래 객체에만 영향을 준다. 이미 존재하는 테이블의
-- GRANT ALL 을 제거하려면 아래 명령이 별도로 필요하다.
-- -----------------------------------------------------------------------------

-- 기존 테이블 전체 권한 회수
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;

-- 기존 시퀀스 전체 권한 회수
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;


-- -----------------------------------------------------------------------------
-- STEP C : anon 최소 권한 재부여
--
-- 근거: STEP 0 / 0.5 코드 추적 결과, anon 클라이언트(createClient / browser)가
-- 실제로 접근하는 테이블 × 작업만 열어준다.
-- -----------------------------------------------------------------------------

-- 공개 페이지 읽기
-- src/app/(public)/* 전반에서 createClient() 로 SELECT 사용 확인됨
-- RLS 정책(published / sent 필터)이 실제 행 노출 범위를 제한한다
GRANT SELECT ON insights          TO anon;
GRANT SELECT ON articles          TO anon;
GRANT SELECT ON categories        TO anon;
GRANT SELECT ON newsletter_issues TO anon;
GRANT SELECT ON competitions      TO anon;

-- insights view_count 증가
-- src/app/api/insights/[slug]/view/route.ts : createClient() 로 UPDATE { view_count } 만 수행
-- 컬럼 단위 GRANT 로 다른 컬럼(hook, summary 등) 수정 권한은 주지 않는다
GRANT UPDATE (view_count) ON insights TO anon;

-- 인사이트 피드백 제출
-- src/app/api/feedback/route.ts : createClient() 로 feedback INSERT 수행
-- 라이브 DB 확인: RLS ON, polcmd='a'(INSERT only), polroles={anon}
GRANT INSERT ON feedback TO anon;

-- feedback PK 시퀀스 권한 (조건부)
-- feedback 테이블은 Supabase 기본값인 gen_random_uuid() UUID PK 로 추정 →
-- 시퀀스 GRANT 불필요. serial / bigserial / identity 방식이면 아래 줄 주석 해제:
-- GRANT USAGE ON SEQUENCE feedback_id_seq TO anon;


-- -----------------------------------------------------------------------------
-- STEP D : authenticated 최소 권한 재부여
--
-- 어드민이 로그인한 채 공개 페이지를 방문하면 서버 createClient() 가
-- JWT 쿠키를 자동으로 첨부해 authenticated 롤로 동작한다.
-- 모든 admin 데이터 쓰기는 createAdminClient()(service_role) 경유임이
-- STEP 0.5 코드 추적으로 확인됨 → authenticated 에는 anon 동일 최소 집합만 부여.
-- -----------------------------------------------------------------------------

-- 공개 페이지 읽기 (로그인 상태에서도 동일 경로 사용)
GRANT SELECT ON insights          TO authenticated;
GRANT SELECT ON articles          TO authenticated;
GRANT SELECT ON categories        TO authenticated;
GRANT SELECT ON newsletter_issues TO authenticated;
GRANT SELECT ON competitions      TO authenticated;

-- view_count 증가 (로그인 상태에서 공개 인사이트 조회 시 동일 경로)
GRANT UPDATE (view_count) ON insights TO authenticated;

-- 피드백 제출 (로그인 상태에서도 feedback/route.ts 의 createClient() 경로 공유)
GRANT INSERT ON feedback TO authenticated;

-- feedback PK 시퀀스 권한 (조건부) — anon 주석과 동일 조건
-- GRANT USAGE ON SEQUENCE feedback_id_seq TO authenticated;


-- =============================================================================
-- 적용 후 스모크 테스트 체크리스트 (사람이 직접 확인)
-- =============================================================================
--
-- [ ] 1. 공개 /insights 목록 · 상세 페이지 로드 정상
--         (anon SELECT on insights, articles, categories)
--
-- [ ] 2. 인사이트 상세 재진입(또는 새 시크릿 창) 후 DB view_count 증가 확인
--         Supabase 대시보드 → Table Editor → insights 해당 행
--         (anon UPDATE (view_count) on insights)
--
-- [ ] 3. 인사이트 하단 피드백 버튼(도움됨 / 도움 안됨) 제출 → 성공 응답
--         (anon INSERT on feedback)
--
-- [ ] 4. 구독 폼 이메일 입력 → 확인 메일 발송 정상
--         (subscribe/route.ts 는 service_role 경유 → 이 파일 영향 없어야 함)
--
-- [ ] 5. 어드민 로그인 → 대시보드 · 아티클 · 인사이트 · 카드뉴스 · 뉴스레터 기능 정상
--         (admin API 전체 createAdminClient() 경유 확인됨 → 영향 없어야 함)
--
-- [ ] 6. (선택) 임시 테이블 생성 후 anon 으로 SELECT 시도 → 권한 거부 확인
--         CREATE TABLE public.test_anon_block (id int);
--         -- anon 으로 실행: SELECT * FROM public.test_anon_block; → ERROR 기대
--         DROP TABLE public.test_anon_block;
--
-- =============================================================================
