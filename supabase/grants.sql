-- Supabase Dashboard → SQL Editor에서 이 파일 전체 실행
-- https://supabase.com/dashboard/project/ndehtnchkgvpjbxlkazk/sql/new

-- 1. 기존 테이블에 권한 부여
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 2. 앞으로 생성될 테이블에도 자동 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
