-- 뉴스레터 본문 삽입 사진 (Unsplash) — 생성 시 검색해 저장. 기존 호는 NULL(하위호환).
-- Supabase SQL Editor에서 1회 실행.
alter table newsletter_issues
  add column if not exists body_image_url text,          -- Unsplash 이미지 URL (urls.regular)
  add column if not exists body_image_credit text,       -- 작가명 (user.name)
  add column if not exists body_image_credit_link text;  -- 작가 프로필 (user.links.html)
