-- ─────────────────────────────────────────────────────────────
-- sell_shop_item : 소모성 아이템을 상점 가격의 10%로 판매(환급)
--
--  - 판매가(개당) = floor( (구매가 / stockPerUnit) * 0.1 )
--    · 구매가/팩단위 = "소모품 1개의 실구매 가치" → 그 10%를 환급
--  - shop_consumable_inventory.count 를 p_quantity 만큼 차감
--  - member_cdp 잔액/누적획득 증가 + cdp_ledger 원장 기록
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- ⚠️ cdp_ledger.reason / ref_kind 에 CHECK 제약이 있다면
--    'shop_sell' 값을 허용하도록 먼저 제약을 수정해야 합니다.
--    (제약이 없다면 그대로 실행하면 됩니다.)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sell_shop_item(
  p_member_id uuid,
  p_kind      text,
  p_quantity  integer DEFAULT 1
)
RETURNS TABLE (
  refund       integer,
  unit_refund  integer,
  new_balance  integer,
  count_after  integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty         integer := GREATEST(1, COALESCE(p_quantity, 1));
  v_count       integer;
  v_price       integer;
  v_per_unit    integer;   -- stockPerUnit (구매 1회당 지급량)
  v_unit_refund integer;
  v_refund      integer;
  v_balance     integer;
BEGIN
  -- 1) 보유 수량 확인 + 행 잠금 (동시 판매 방지)
  SELECT count INTO v_count
  FROM shop_consumable_inventory
  WHERE member_id = p_member_id AND kind = p_kind
  FOR UPDATE;

  IF v_count IS NULL OR v_count < v_qty THEN
    RAISE EXCEPTION 'not_enough';
  END IF;

  -- 2) 판매 기준: 해당 소모품의 활성 상점 아이템 가격 + 팩 단위
  -- 개당 단가가 가장 비싼 행(=단품 가격)을 기준으로 환급
  -- (대용량 팩 단가를 기준으로 하면 단품 구매자가 64%만 돌려받는 문제)
  SELECT price, GREATEST(1, COALESCE((payload->>'stockPerUnit')::integer, 1))
    INTO v_price, v_per_unit
  FROM shop_items
  WHERE type = 'consumable'
    AND payload->>'kind' = p_kind
    AND is_active = true
  ORDER BY price::numeric / GREATEST(1, COALESCE((payload->>'stockPerUnit')::integer, 1)) DESC
  LIMIT 1;

  IF v_price IS NULL THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- 3) 개당 환급 = floor( (구매가/팩단위) * 0.1 )
  v_unit_refund := FLOOR((v_price::numeric / v_per_unit) * 0.1)::integer;
  v_refund := v_unit_refund * v_qty;

  -- 4) 인벤토리 차감
  UPDATE shop_consumable_inventory
  SET count = count - v_qty, updated_at = now()
  WHERE member_id = p_member_id AND kind = p_kind
  RETURNING count INTO v_count;

  -- 5) CDP 적립 (member_cdp upsert)
  INSERT INTO member_cdp (member_id, balance, total_earned)
  VALUES (p_member_id, v_refund, v_refund)
  ON CONFLICT (member_id) DO UPDATE
  SET balance      = member_cdp.balance + v_refund,
      total_earned = member_cdp.total_earned + v_refund,
      updated_at   = now()
  RETURNING balance INTO v_balance;

  -- 6) 원장 기록 (id / created_at 은 DB 기본값)
  INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
  VALUES (
    p_member_id, v_refund, v_balance, 'shop_sell', 'shop_sell', NULL,
    jsonb_build_object('kind', p_kind, 'quantity', v_qty, 'unit_refund', v_unit_refund)
  );

  refund      := v_refund;
  unit_refund := v_unit_refund;
  new_balance := v_balance;
  count_after := v_count;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_shop_item(uuid, text, integer) TO service_role;
