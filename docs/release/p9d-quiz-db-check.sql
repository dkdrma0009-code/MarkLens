-- 운영 DB의 학습 퀴즈 문제 수 확인. 읽기 전용: SELECT 한 문장이며 쓰기·권한 변경이 없고, 문제 본문은 돌려주지 않는다.
-- 운영자가 Supabase SQL Editor에서 직접 실행한다. 사용 방법과 결과 해석: docs/release/p9e-operator-checks.md
-- 앱과 같은 기준으로 센다(src/app/api/learn/generate/route.ts의 random_quiz 조회, 객관식 필터, dedupeKey).
WITH expected(level, type) AS (
  VALUES
    ('beginner', 'multiple_choice'), ('beginner', 'short_answer'),
    ('intermediate', 'multiple_choice'), ('intermediate', 'short_answer'),
    ('advanced', 'multiple_choice'), ('advanced', 'short_answer')
),
q AS (
  SELECT
    level,
    type,
    created_at,
    data::jsonb ->> 'type' AS data_type,
    left(regexp_replace(lower(coalesce(data::jsonb ->> 'question', '')), '[^가-힣a-z0-9]', '', 'g'), 20) AS dedupe_key,
    CASE WHEN jsonb_typeof(data::jsonb -> 'options') = 'array' AND jsonb_typeof(data::jsonb -> 'answer') = 'number' THEN
      CASE WHEN jsonb_array_length(data::jsonb -> 'options') >= 2
            AND (data::jsonb ->> 'answer')::numeric >= 0
            AND (data::jsonb ->> 'answer')::numeric < jsonb_array_length(data::jsonb -> 'options')
            AND (data::jsonb ->> 'answer')::numeric = trunc((data::jsonb ->> 'answer')::numeric)
      THEN true ELSE false END
    ELSE false END AS mc_valid
  FROM public.quiz_questions
),
counted AS (
  SELECT
    level,
    type,
    count(*) AS total,
    count(*) FILTER (WHERE data_type IS DISTINCT FROM type) AS type_mismatch,
    count(*) FILTER (WHERE type = 'multiple_choice' AND NOT mc_valid) AS invalid_choices,
    count(DISTINCT dedupe_key) FILTER (WHERE type = 'multiple_choice' AND data_type = 'multiple_choice' AND mc_valid AND dedupe_key <> '') AS usable_ai_off,
    min(created_at)::date AS oldest,
    max(created_at)::date AS newest
  FROM q
  GROUP BY level, type
)
SELECT
  level,
  type,
  coalesce(total, 0) AS total,
  coalesce(usable_ai_off, 0) AS usable_ai_off,
  coalesce(type_mismatch, 0) AS type_mismatch,
  coalesce(invalid_choices, 0) AS invalid_choices,
  oldest,
  newest,
  CASE
    WHEN level NOT IN ('beginner', 'intermediate', 'advanced') THEN '화면에서 쓰지 않는 난이도'
    WHEN type <> 'multiple_choice' THEN '-'
    WHEN coalesce(usable_ai_off, 0) >= 10 THEN '정상'
    WHEN coalesce(usable_ai_off, 0) >= 1 THEN '부족'
    ELSE '0개'
  END AS verdict,
  to_regprocedure('public.random_quiz(text,text,integer)') IS NOT NULL AS random_quiz_exists
FROM expected
FULL JOIN counted USING (level, type)
ORDER BY level, type;
