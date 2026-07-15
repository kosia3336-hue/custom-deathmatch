-- ─────────────────────────────────────────────────────────────
-- #3 일일 랭크 승리 보너스 (하루 첫 승리 1회 100 CDP)
-- #4 하루 랭크 5승 시 뽑기 박스(gacha_box) 1개 지급
--
-- 하루 기준: 한국시간(KST, Asia/Seoul) 자정
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--       (이미 이전 버전을 실행했더라도 이 파일을 다시 실행하면 됩니다 —
--        테이블은 IF NOT EXISTS, 함수는 CREATE OR REPLACE 라 안전)
--
-- ⚠️ cdp_ledger.reason / ref_kind 에 CHECK 제약이 있다면
--    'daily_rank_win' / 'daily_rank' 값을 허용하도록 먼저 수정하세요.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_rank_stats (
  member_id    uuid    NOT NULL,
  stat_date    date    NOT NULL,               -- KST 기준 날짜
  win_count    integer NOT NULL DEFAULT 0,     -- 오늘 랭크 승수
  cdp_rewarded boolean NOT NULL DEFAULT false, -- #3: 100 CDP 지급 여부
  box_rewarded boolean NOT NULL DEFAULT false, -- #4: 5승 뽑기박스 지급 여부
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, stat_date)
);

-- 랭크 승리 1건 처리:
--   · win_count += 1
--   · 오늘 첫 승리면 100 CDP 지급 (#3)
--   · 오늘 누적 5승 도달 시 뽑기 박스 1개 지급 (#4, 하루 1회)
CREATE OR REPLACE FUNCTION public.claim_daily_rank_win(p_member_id uuid)
RETURNS TABLE (
  granted     boolean,  -- 100 CDP 지급 여부
  cdp_amount  integer,
  new_balance integer,
  win_count   integer,
  box_granted boolean   -- 뽑기 박스 지급 여부
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date          date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_reward        constant integer := 100;
  v_box_threshold constant integer := 5;
  v_was_cdp       boolean;
  v_was_box       boolean;
  v_win           integer;
  v_balance       integer;
  v_cdp_granted   boolean := false;
  v_box_granted   boolean := false;
BEGIN
  -- 오늘 행 upsert + win_count 증가. RETURNING = (증가 후 win_count, 이전 지급플래그들).
  INSERT INTO daily_rank_stats (member_id, stat_date, win_count)
  VALUES (p_member_id, v_date, 1)
  ON CONFLICT (member_id, stat_date) DO UPDATE
    SET win_count = daily_rank_stats.win_count + 1,
        updated_at = now()
  RETURNING daily_rank_stats.win_count, daily_rank_stats.cdp_rewarded, daily_rank_stats.box_rewarded
    INTO v_win, v_was_cdp, v_was_box;

  -- ── #3: 오늘 첫 승리 → 100 CDP ──
  IF NOT v_was_cdp THEN
    UPDATE daily_rank_stats SET cdp_rewarded = true, updated_at = now()
      WHERE member_id = p_member_id AND stat_date = v_date;

    INSERT INTO member_cdp (member_id, balance, total_earned)
    VALUES (p_member_id, v_reward, v_reward)
    ON CONFLICT (member_id) DO UPDATE
    SET balance      = member_cdp.balance + v_reward,
        total_earned = member_cdp.total_earned + v_reward,
        updated_at   = now()
    RETURNING balance INTO v_balance;

    INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
    VALUES (
      p_member_id, v_reward, v_balance, 'daily_rank_win', 'daily_rank', NULL,
      jsonb_build_object('stat_date', v_date)
    );

    v_cdp_granted := true;
  ELSE
    SELECT balance INTO v_balance FROM member_cdp WHERE member_id = p_member_id;
  END IF;

  -- ── #4: 오늘 누적 5승 도달 → 뽑기 박스 1개 (하루 1회) ──
  IF v_win >= v_box_threshold AND NOT v_was_box THEN
    UPDATE daily_rank_stats SET box_rewarded = true, updated_at = now()
      WHERE member_id = p_member_id AND stat_date = v_date;

    INSERT INTO shop_consumable_inventory (member_id, kind, count)
    VALUES (p_member_id, 'gacha_box', 1)
    ON CONFLICT (member_id, kind) DO UPDATE
      SET count = shop_consumable_inventory.count + 1, updated_at = now();

    v_box_granted := true;
  END IF;

  granted     := v_cdp_granted;
  cdp_amount  := CASE WHEN v_cdp_granted THEN v_reward ELSE 0 END;
  new_balance := COALESCE(v_balance, 0);
  win_count   := v_win;
  box_granted := v_box_granted;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_rank_win(uuid) TO service_role;
