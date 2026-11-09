-- P9D: 운영 DB의 학습 퀴즈 문제 수 확인 (읽기 전용, SELECT 한 문장). 승인 전에는 실행하지 않는다.
-- 문제 본문은 조회하지 않고 수량·날짜만 돌려준다. 앱과 같은 기준으로 센다(src/app/api/learn/generate/route.ts):
--   served_ai_off: AI 중단 시 실제로 나갈 수 있는 객관식(열과 data의 type이 모두 multiple_choice이고 보기·정답이 유효)
--   distinct_ai_off: 그중 유사문제 제거(pickDistinct의 dedupeKey) 후 수. 판정은 이 값으로 한다.
WITH q AS (
  SELECT
    level,
    type,
    created_at,
    data->>'type' AS data_type,
    left(regexp_replace(lower(coalesce(data->>'question', '')), '[^가-힣a-z0-9]', '', 'g'), 20) AS dedupe_key,
    CASE
      WHEN jsonb_typeof(data->'options') = 'array'
       AND jsonb_array_length(data->'options') >= 2
       AND jsonb_typeof(data->'answer') = 'number'
       AND (data->>'answer')::numeric >= 0
       AND (data->>'answer')::numeric < jsonb_array_length(data->'options')
       AND (data->>'answer')::numeric = trunc((data->>'answer')::numeric)
      THEN true ELSE false
    END AS mc_valid
  FROM public.quiz_questions
)
SELECT
  level,
  type,
  count(*) AS total,
  count(*) FILTER (WHERE data_type IS DISTINCT FROM type) AS type_mismatch,
  count(*) FILTER (WHERE type = 'multiple_choice' AND data_type = 'multiple_choice' AND mc_valid) AS served_ai_off,
  count(*) FILTER (WHERE type = 'multiple_choice' AND NOT mc_valid) AS invalid_choices,
  count(DISTINCT dedupe_key) FILTER (WHERE type = 'multiple_choice' AND data_type = 'multiple_choice' AND mc_valid AND dedupe_key <> '') AS distinct_ai_off,
  count(DISTINCT dedupe_key) FILTER (WHERE type = 'short_answer' AND dedupe_key <> '') AS distinct_short_answer,
  min(created_at)::date AS oldest,
  max(created_at)::date AS newest,
  to_regprocedure('public.random_quiz(text,text,integer)') IS NOT NULL AS random_quiz_exists
FROM q
GROUP BY level, type
ORDER BY level, type;
