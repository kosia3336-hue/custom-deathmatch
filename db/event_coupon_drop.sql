-- ─────────────────────────────────────────────────────────────
-- 이벤트 쿠폰함 철거 (되돌릴 수 없음)
--
--   쿠폰함 기능은 코드에서 제거됐다. 아래는 남은 DB 오브젝트 정리다.
--   · event_coupons     — 응모 기록 (실행 시점 223행)
--   · event_coupon_box  — 열림/닫힘 토글 1행
--   · deposit_event_coupons() — 쿠폰 투입 RPC
--
--   ⚠ 이벤트 '게임'(인디언홀덤 이벤트·해달별 이벤트) 관련 테이블
--     (event_chips / member_event_chips / event_chip_ledger / event_seasons 등)은
--     건드리지 않는다. 게임이 그대로 돌아가야 하므로 여기 포함하지 않았다.
--
--   실행 전 권장: 응모 기록을 남겨두고 싶다면 먼저 백업한다.
--     SELECT * FROM event_coupons ORDER BY created_at;  -- 결과를 CSV 로 내려받기
-- ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.deposit_event_coupons(uuid, integer);

DROP TABLE IF EXISTS public.event_coupons;
DROP TABLE IF EXISTS public.event_coupon_box;

-- 확인 — 아래가 0행이면 정리 완료
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('event_coupons', 'event_coupon_box');
