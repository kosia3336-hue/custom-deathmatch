-- ─────────────────────────────────────────────────────────────
-- #5 출석판 (출석 체크)
--   · 하루 1회(KST) 출석 → 랜덤 보상: 100 CDP 또는 뽑기권 1개
--   · 누적 30회 출석 시 뽑기 박스 10개 + 사이클 리셋(cycle_days=0)
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- ⚠️ cdp_ledger.reason / ref_kind 에 CHECK 제약이 있다면
--    'attendance' 값을 허용하도록 먼저 수정하세요.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance (
  member_id       uuid PRIMARY KEY,
  last_check_date date,                            -- 마지막 출석한 KST 날짜
  cycle_days      integer NOT NULL DEFAULT 0,      -- 이번 사이클 누적 출석 수 (0~29, 30 도달 시 0으로 리셋)
  total_days      integer NOT NULL DEFAULT 0,      -- 총 출석 수(통계)
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.check_attendance(p_member_id uuid)
RETURNS TABLE (
  reward_kind  text,     -- 'cdp' | 'ticket'
  cdp_amount   integer,  -- 100 (cdp 보상 시) / 0
  new_balance  integer,  -- CDP 잔액
  ticket_count integer,  -- gacha_ticket 잔량
  cycle_days   integer,  -- 출석 후 사이클 누적 (완주 시 0)
  total_days   integer,
  completed    boolean,  -- 30회 완주 여부
  box_count    integer   -- gacha_box 잔량 (완주 시 +10 반영)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date      date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_last      date;
  v_cycle     integer;
  v_total     integer;
  v_reward    text;
  v_cdp       integer := 0;
  v_balance   integer;
  v_ticket    integer;
  v_completed boolean := false;
  v_box       integer;
BEGIN
  INSERT INTO attendance (member_id, cycle_days, total_days)
  VALUES (p_member_id, 0, 0)
  ON CONFLICT (member_id) DO NOTHING;

  SELECT a.last_check_date, a.cycle_days, a.total_days
    INTO v_last, v_cycle, v_total
  FROM attendance a WHERE a.member_id = p_member_id FOR UPDATE;

  IF v_last = v_date THEN
    RAISE EXCEPTION 'already_checked_in';
  END IF;

  v_cycle := v_cycle + 1;
  v_total := v_total + 1;

  -- 랜덤 보상: 50% 100 CDP / 50% 뽑기권 1개
  IF random() < 0.5 THEN
    v_reward := 'cdp';
    v_cdp := 100;
    INSERT INTO member_cdp (member_id, balance, total_earned)
    VALUES (p_member_id, v_cdp, v_cdp)
    ON CONFLICT (member_id) DO UPDATE
      SET balance = member_cdp.balance + v_cdp,
          total_earned = member_cdp.total_earned + v_cdp,
          updated_at = now()
    RETURNING balance INTO v_balance;

    INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
    VALUES (p_member_id, v_cdp, v_balance, 'attendance', 'attendance', NULL,
            jsonb_build_object('date', v_date));
  ELSE
    v_reward := 'ticket';
    INSERT INTO shop_consumable_inventory (member_id, kind, count)
    VALUES (p_member_id, 'gacha_ticket', 1)
    ON CONFLICT (member_id, kind) DO UPDATE
      SET count = shop_consumable_inventory.count + 1, updated_at = now();
    SELECT balance INTO v_balance FROM member_cdp WHERE member_id = p_member_id;
  END IF;

  -- 누적 30회 완주 → 뽑기 박스 10개 + 사이클 리셋
  IF v_cycle >= 30 THEN
    v_completed := true;
    INSERT INTO shop_consumable_inventory (member_id, kind, count)
    VALUES (p_member_id, 'gacha_box', 10)
    ON CONFLICT (member_id, kind) DO UPDATE
      SET count = shop_consumable_inventory.count + 10, updated_at = now();
    v_cycle := 0;
  END IF;

  UPDATE attendance a
  SET last_check_date = v_date, cycle_days = v_cycle, total_days = v_total, updated_at = now()
  WHERE a.member_id = p_member_id;

  SELECT count INTO v_ticket FROM shop_consumable_inventory WHERE member_id = p_member_id AND kind = 'gacha_ticket';
  SELECT count INTO v_box    FROM shop_consumable_inventory WHERE member_id = p_member_id AND kind = 'gacha_box';

  reward_kind  := v_reward;
  cdp_amount   := v_cdp;
  new_balance  := COALESCE(v_balance, 0);
  ticket_count := COALESCE(v_ticket, 0);
  cycle_days   := v_cycle;
  total_days   := v_total;
  completed    := v_completed;
  box_count    := COALESCE(v_box, 0);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_attendance(uuid) TO service_role;
