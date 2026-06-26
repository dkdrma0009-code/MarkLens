-- subscribers.drip_step — 온보딩 드립 시퀀스 진행 단계 추적
--
-- 0 = 웰컴 메일만 발송됨(기본). 드립 크론이 단계별로 1, 2... 로 올리며 다음 메일 발송.
-- 기존 활성 구독자는 이미 온보딩이 끝났으므로 99(완료)로 세팅해 드립 메일을 받지 않게 한다.
-- 신규 구독자는 default 0으로 들어와 드립 시퀀스를 받는다.
--
-- Supabase SQL Editor에서 1회 실행. 재실행해도 안전.

ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS drip_step smallint NOT NULL DEFAULT 0;

-- 이미 구독 중인 사람은 드립 대상에서 제외 (스팸 방지)
UPDATE subscribers SET drip_step = 99 WHERE status = 'active' AND drip_step = 0;
