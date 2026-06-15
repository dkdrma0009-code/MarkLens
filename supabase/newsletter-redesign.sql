-- 뉴스레터 "한 주제 깊이형" 개편 — 신규 컬럼 추가 (기존 5섹션 컬럼은 과거 호 렌더용 유지)
-- Supabase SQL Editor에서 1회 실행.
alter table newsletter_issues
  add column if not exists topic_headline text,    -- 이번 주 단 하나의 주제 핵심 명제 (인용구 박스)
  add column if not exists body_sections jsonb,    -- [{subhead, paragraphs[]}] 본문 소단락
  add column if not exists key_takeaways text[],   -- 핵심 인사이트 2~3개 (정리 박스)
  add column if not exists for_your_career text;   -- 취준 응축 (면접/포폴 팁)
