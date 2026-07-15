-- ─────────────────────────────────────────────────────────────
-- open_gacha_box : 뽑기 박스 1개를 개봉하여 뽑기권 1~5장 랜덤 지급
--
--  - shop_consumable_inventory 의 'gacha_box' 1개 차감
--  - 'gacha_ticket' 을 1~5장(랜덤) 적립
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_gacha_box(p_member_id uuid)
RETURNS TABLE (
  tickets_granted     integer,
  box_count_after     integer,
  ticket_count_after  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_box    integer;
  v_grant  integer;
  v_ticket integer;
BEGIN
  -- 박스 보유 확인 + 행 잠금 (동시 개봉 방지)
  SELECT count INTO v_box
  FROM shop_consumable_inventory
  WHERE member_id = p_member_id AND kind = 'gacha_box'
  FOR UPDATE;

  IF v_box IS NULL OR v_box < 1 THEN
    RAISE EXCEPTION 'no_box';
  END IF;

  -- 1~5장 랜덤
  v_grant := floor(random() * 5)::integer + 1;

  -- 박스 1개 차감
  UPDATE shop_consumable_inventory
  SET count = count - 1, updated_at = now()
  WHERE member_id = p_member_id AND kind = 'gacha_box'
  RETURNING count INTO v_box;

  -- 뽑기권 지급
  INSERT INTO shop_consumable_inventory (member_id, kind, count)
  VALUES (p_member_id, 'gacha_ticket', v_grant)
  ON CONFLICT (member_id, kind) DO UPDATE
    SET count = shop_consumable_inventory.count + v_grant, updated_at = now()
  RETURNING count INTO v_ticket;

  tickets_granted    := v_grant;
  box_count_after    := v_box;
  ticket_count_after := v_ticket;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_gacha_box(uuid) TO service_role;
