-- ─────────────────────────────────────────────────────────────
-- 이벤트 쿠폰함
--   · 랭크게임 승리 시 자신의 닉네임이 적힌 이벤트 쿠폰 1장 자동 지급
--   · 이벤트 종료 전까지 /event 페이지에서 원하는 만큼 쿠폰함에 투입
--   · 이벤트 종료 후 관리자가 쿠폰함을 닫고, 모인 쿠폰을 보고 수동 추첨
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ─────────────────────────────────────────────────────────────

-- 쿠폰함 설정 (단일 로우) — is_open=false 면 지급/투입 모두 중단
CREATE TABLE IF NOT EXISTS public.event_coupon_box (
  id         integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title      text NOT NULL DEFAULT '이벤트 쿠폰함',
  is_open    boolean NOT NULL DEFAULT true,   -- 열려 있는 동안만 쿠폰 지급·투입 가능
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.event_coupon_box (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 이벤트 쿠폰 1장 = 1로우
CREATE TABLE IF NOT EXISTS public.event_coupons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES public.members(id),
  nickname      text NOT NULL,               -- 지급 시점 닉네임 (쿠폰에 적힌 이름)
  source        text NOT NULL DEFAULT 'rank_win',
  ref_id        text,                        -- 지급 근거 (rank_match_history.id 등)
  earned_at     timestamptz NOT NULL DEFAULT now(),
  deposited_at  timestamptz                  -- NULL = 보유 중 / NOT NULL = 쿠폰함 투입 완료
);

CREATE INDEX IF NOT EXISTS event_coupons_member_idx ON public.event_coupons (member_id);
CREATE INDEX IF NOT EXISTS event_coupons_deposited_idx
  ON public.event_coupons (deposited_at) WHERE deposited_at IS NOT NULL;

-- 접근은 서비스 롤(서버)만 — RLS 활성화 + 정책 없음
ALTER TABLE public.event_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_coupon_box ENABLE ROW LEVEL SECURITY;

-- 쿠폰함 투입 (보유 쿠폰 중 오래된 것부터 p_count 장) — 실제 투입된 장수 반환
CREATE OR REPLACE FUNCTION public.deposit_event_coupons(p_member_id uuid, p_count integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open      boolean;
  v_deposited integer;
BEGIN
  SELECT is_open INTO v_open FROM event_coupon_box WHERE id = 1 FOR UPDATE;
  IF NOT COALESCE(v_open, false) THEN
    RAISE EXCEPTION 'box_closed';
  END IF;
  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'invalid_count';
  END IF;

  WITH picked AS (
    SELECT id FROM event_coupons
    WHERE member_id = p_member_id AND deposited_at IS NULL
    ORDER BY earned_at
    LIMIT p_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE event_coupons c
  SET deposited_at = now()
  FROM picked
  WHERE c.id = picked.id;

  GET DIAGNOSTICS v_deposited = ROW_COUNT;
  IF v_deposited = 0 THEN
    RAISE EXCEPTION 'no_coupons';
  END IF;
  RETURN v_deposited;
END;
$$;
