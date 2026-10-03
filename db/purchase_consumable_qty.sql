-- ============================================================
-- 소모품 수량 구매 + 대량 할인
--   · 5개 이상: 10% 할인 / 20개 이상: 20% 할인
--   · 거상(first_merchant) 할인 10%는 대량 할인 후 곱연산 (payload.no_discount=true 면 제외)
--   · (5개입)/(20개입) 팩 상품은 비활성화하고 단품만 남긴다
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ============================================================

-- 1) 팩 상품 비활성화 + 단품 이름 정리
UPDATE shop_items
   SET is_active = false, updated_at = now()
 WHERE type = 'consumable'
   AND COALESCE((payload->>'stockPerUnit')::int, 1) > 1;

UPDATE shop_items
   SET name = regexp_replace(name, '\s*\(1개\)$', ''), updated_at = now()
 WHERE type = 'consumable'
   AND name ~ '\s*\(1개\)$';

-- 2) 수량 구매 RPC
CREATE OR REPLACE FUNCTION public.purchase_consumable_qty(
  p_member_id uuid,
  p_item_id   uuid,
  p_quantity  integer,
  p_merchant  boolean DEFAULT false
)
RETURNS TABLE (
  purchase_id      uuid,
  new_balance      integer,
  price_paid       integer,
  price_original   integer,
  discount_applied integer,
  consumable_kind  text,
  consumable_added integer,
  count_after      integer,
  stock_after      integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty        integer := COALESCE(p_quantity, 1);
  v_item       shop_items%ROWTYPE;
  v_kind       text;
  v_no_disc    boolean;
  v_original   integer;
  v_bulk_rate  numeric := 0;
  v_total      integer;
  v_balance    integer;
  v_count      integer;
  v_purchase   uuid;
BEGIN
  IF v_qty < 1 OR v_qty > 99 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;

  SELECT * INTO v_item FROM shop_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF v_item.type <> 'consumable' THEN RAISE EXCEPTION 'item_not_found'; END IF;
  -- 데브 전용(payload.devOnly)은 운영 목록에서 꺼 두되, 데브 세션 구매는 허용한다.
  IF NOT v_item.is_active AND COALESCE((v_item.payload->>'devOnly')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'item_inactive';
  END IF;
  IF v_item.available_from IS NOT NULL AND now() < v_item.available_from THEN
    RAISE EXCEPTION 'item_not_available_yet';
  END IF;
  IF v_item.available_until IS NOT NULL AND now() > v_item.available_until THEN
    RAISE EXCEPTION 'item_expired';
  END IF;
  IF v_item.stock IS NOT NULL AND v_item.stock < v_qty THEN
    RAISE EXCEPTION 'out_of_stock';
  END IF;

  v_kind := v_item.payload->>'kind';
  v_no_disc := COALESCE((v_item.payload->>'no_discount')::boolean, false);

  -- 가격: 정가 = 단가 × 수량
  v_original := v_item.price * v_qty;

  -- 대량 할인: 20개↑ 20%, 5개↑ 10%
  IF v_qty >= 20 THEN v_bulk_rate := 0.20;
  ELSIF v_qty >= 5 THEN v_bulk_rate := 0.10;
  END IF;

  v_total := FLOOR(v_original * (1 - v_bulk_rate))::integer;

  -- 거상 할인 10% (no_discount 아이템 제외)
  IF p_merchant AND NOT v_no_disc THEN
    v_total := FLOOR(v_total * 0.9)::integer;
  END IF;

  -- 잔액 차감
  UPDATE member_cdp
     SET balance = balance - v_total,
         total_spent = total_spent + v_total,
         updated_at = now()
   WHERE member_id = p_member_id AND balance >= v_total
  RETURNING balance INTO v_balance;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  -- 재고 차감 (한정 판매 시)
  IF v_item.stock IS NOT NULL THEN
    UPDATE shop_items SET stock = stock - v_qty, updated_at = now() WHERE id = p_item_id;
  END IF;

  -- 구매 기록
  INSERT INTO shop_purchases (member_id, item_id, price_paid, payload_snapshot, name_snapshot, type_snapshot)
  VALUES (
    p_member_id, p_item_id, v_total,
    v_item.payload || jsonb_build_object('quantity', v_qty, 'bulk_discount', v_bulk_rate),
    v_item.name, v_item.type
  )
  RETURNING id INTO v_purchase;

  -- 원장
  INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
  VALUES (
    p_member_id, -v_total, v_balance, 'shop_purchase', 'shop_purchase', v_purchase::text,
    jsonb_build_object('item_id', p_item_id, 'kind', v_kind, 'quantity', v_qty,
                       'price_original', v_original, 'bulk_discount', v_bulk_rate)
  );

  -- 인벤토리 적립
  INSERT INTO shop_consumable_inventory (member_id, kind, count)
  VALUES (p_member_id, v_kind, v_qty)
  ON CONFLICT (member_id, kind) DO UPDATE
    SET count = shop_consumable_inventory.count + v_qty, updated_at = now()
  RETURNING count INTO v_count;

  purchase_id      := v_purchase;
  new_balance      := v_balance;
  price_paid       := v_total;
  price_original   := v_original;
  discount_applied := v_original - v_total;
  consumable_kind  := v_kind;
  consumable_added := v_qty;
  count_after      := v_count;
  stock_after      := (SELECT stock FROM shop_items WHERE id = p_item_id);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_consumable_qty(uuid, uuid, integer, boolean) TO service_role;
