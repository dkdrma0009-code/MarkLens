-- PREVIEW / LOCAL ONLY. Synthetic content so the public pages, list, detail and quiz render on an empty Preview
-- database. No real article, person, email or token. Every automation flag is off.
BEGIN;

INSERT INTO public.app_config (key, value) VALUES
  ('ig_auto_publish', 'off'), ('site_publish_auto', 'off'), ('curation_auto_publish', 'off'),
  -- marks this database as a Preview one; scripts/release/verify-preview-db.mjs requires it (production has no such row)
  ('marklens_environment', 'preview')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.articles (id, title, url, source, source_name, status, published_at, site_published_at) VALUES
  ('00000000-0000-4000-8000-000000000001', '[Preview sample] Loyalty points replace coupons', 'https://example.test/preview-1', 'preview', 'Preview Sample', 'published', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000002', '[Preview sample] Pop-up stores move abroad', 'https://example.test/preview-2', 'preview', 'Preview Sample', 'published', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000003', '[Preview sample] Short video changes search', 'https://example.test/preview-3', 'preview', 'Preview Sample', 'published', now() - interval '3 days', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.insights (article_id, slug, hook, summary, key_takeaways, why_it_matters, framework_analysis, practical_applications, category, tags, keywords) VALUES
  ('00000000-0000-4000-8000-000000000001', 'preview-sample-1', '[Preview 샘플] 할인 대신 적립, 멤버십의 셈법', 'Preview 검증용 합성 요약입니다.', ARRAY['샘플 포인트 1', '샘플 포인트 2', '샘플 포인트 3'], 'Preview 검증용 본문입니다.', 'Preview 검증용 해석입니다.', '첫째, 샘플 적용.' || chr(10) || '둘째, 샘플 적용.', '브랜딩', ARRAY['멤버십', 'Preview'], ARRAY['적립']),
  ('00000000-0000-4000-8000-000000000002', 'preview-sample-2', '[Preview 샘플] 팝업이 해외로 가는 이유', 'Preview 검증용 합성 요약입니다.', ARRAY['샘플 포인트'], 'Preview 검증용 본문입니다.', NULL, NULL, '브랜딩', ARRAY['팝업', 'Preview'], ARRAY['오프라인']),
  ('00000000-0000-4000-8000-000000000003', 'preview-sample-3', '[Preview 샘플] 숏폼이 검색을 바꾼다', 'Preview 검증용 합성 요약입니다.', ARRAY['샘플 포인트'], 'Preview 검증용 본문입니다.', NULL, NULL, '콘텐츠 마케팅', ARRAY['숏폼'], ARRAY['검색'])
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.quiz_questions (level, type, data) VALUES
  ('beginner', 'multiple_choice', '{"type":"multiple_choice","question":"[Preview] ROAS는 무엇의 약자인가요?","options":["Return On Ad Spend","Rate Of Ad Sales"],"answer":0,"explanation":"Preview 샘플 문제"}'),
  ('beginner', 'short_answer', '{"type":"short_answer","question":"[Preview] 검색엔진 최적화의 약자는?","answer":"SEO","explanation":"Preview 샘플 문제"}')
ON CONFLICT DO NOTHING;

COMMIT;
