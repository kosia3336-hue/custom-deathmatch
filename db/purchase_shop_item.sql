-- 상점 구매 RPC. payload.effect_id + duration_days 로 이펙트 기간제 지급/연장.
-- 누군가(개발자 천하 제외) 영구 보유하면 effect_permanently_claimed. 기간제는 GREATEST(now, expires_at)+N일.
--
-- 실행: apply_migration 또는 대시보드 SQL Editor

CREATE OR REPLACE FUNCTION public.purchase_shop_item(p_member_id uuid, p_item_id uuid)
 RETURNS TABLE(purchase_id uuid, new_balance integer, price_paid integer, price_original integer, discount_applied integer, stock_after integer, granted_title_id uuid, consumable_kind text, consumable_added integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item              record;
  v_balance           integer;
  v_purchase_id       uuid;
  v_title_id          uuid;
  v_now               timestamptz := now();
  v_unique            boolean;
  v_no_discount       bool;
  v_apply_discount    boolean := false;
  v_price_original    integer;
  v_price_paid        integer;
  v_discount          integer := 0;
  v_stock_after       integer;
  v_consumable_kind   text;
  v_consumable_per    integer;
  v_consumable_added  integer := 0;
  v_first_merchant_active boolean := false;
  v_skin_id           text;
  v_effect_id         uuid;
  v_duration_days     integer := 0;
  v_effect_grant_id   bigint;
  v_effect_expires    timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM members m
      JOIN members_private p ON p.member_id = m.id
     WHERE m.id = p_member_id
       AND m.withdrawn_at IS NULL
       AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'member_not_active';
  END IF;

  SELECT * INTO v_item FROM shop_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND                                       THEN RAISE EXCEPTION 'item_not_found';        END IF;
  IF NOT v_item.is_active                            THEN RAISE EXCEPTION 'item_inactive';         END IF;
  IF v_item.available_from  IS NOT NULL AND v_now < v_item.available_from  THEN RAISE EXCEPTION 'item_not_available_yet'; END IF;
  IF v_item.available_until IS NOT NULL AND v_now > v_item.available_until THEN RAISE EXCEPTION 'item_expired';           END IF;
  IF v_item.stock IS NOT NULL AND v_item.stock <= 0  THEN RAISE EXCEPTION 'out_of_stock';          END IF;

  v_price_original := v_item.price;

  v_unique := COALESCE((v_item.payload->>'unique')::boolean, false);
  IF v_unique THEN
    IF EXISTS (
      SELECT 1 FROM shop_purchases
       WHERE member_id = p_member_id AND item_id = p_item_id
    ) THEN
      RAISE EXCEPTION 'already_owned';
    END IF;
  END IF;

  v_effect_id := NULLIF(v_item.payload->>'effect_id', '')::uuid;
  IF v_effect_id IS NOT NULL THEN
    v_duration_days := COALESCE((v_item.payload->>'duration_days')::integer, 0);
    IF v_duration_days <= 0 THEN
      RAISE EXCEPTION 'invalid_effect_duration';
    END IF;
    -- 누군가(개발자 천하 제외) 영구 보유하면 전역 판매 중지. 기존 기간제는 만료까지 유지.
    IF EXISTS (
      SELECT 1 FROM member_title_effects mte
       WHERE mte.effect_id = v_effect_id
         AND mte.revoked_at IS NULL
         AND mte.expires_at IS NULL
         AND NOT public.is_dev_effect_holder(mte.member_id)
    ) THEN
      RAISE EXCEPTION 'effect_permanently_claimed';
    END IF;
    IF EXISTS (
      SELECT 1 FROM member_title_effects
       WHERE member_id = p_member_id
         AND effect_id = v_effect_id
         AND revoked_at IS NULL
         AND expires_at IS NULL
    ) THEN
      RAISE EXCEPTION 'already_owned';
    END IF;
  END IF;

  v_no_discount := COALESCE((v_item.payload->>'no_discount')::boolean, false);
  IF NOT v_no_discount THEN
    SELECT EXISTS (
      SELECT 1
        FROM shop_items si
        JOIN member_titles mt
             ON mt.title_id = NULLIF(si.payload->>'title_id', '')::uuid
            AND mt.member_id = p_member_id
            AND mt.revoked_at IS NULL
        JOIN rank_seasons rs
             ON rs.id = COALESCE(NULLIF(si.payload->>'season_id', ''), '0')::integer
            AND rs.is_active = true
       WHERE si.payload->>'kind' = 'first_merchant'
    ) INTO v_first_merchant_active;

    v_apply_discount := v_first_merchant_active;
  END IF;

  IF v_apply_discount THEN
    v_price_paid := floor(v_price_original::numeric * 0.9)::integer;
    v_discount   := v_price_original - v_price_paid;
  ELSE
    v_price_paid := v_price_original;
    v_discount   := 0;
  END IF;

  INSERT INTO member_cdp(member_id) VALUES (p_member_id) ON CONFLICT (member_id) DO NOTHING;
  SELECT balance INTO v_balance FROM member_cdp WHERE member_id = p_member_id FOR UPDATE;
  IF v_balance < v_price_paid THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  INSERT INTO shop_purchases (
    member_id, item_id, price_paid,
    payload_snapshot, name_snapshot, type_snapshot
  ) VALUES (
    p_member_id, p_item_id, v_price_paid,
    v_item.payload || jsonb_build_object(
      'price_original',   v_price_original,
      'discount_applied', v_discount
    ),
    v_item.name, v_item.type
  ) RETURNING id INTO v_purchase_id;

  UPDATE member_cdp
     SET balance     = balance - v_price_paid,
         total_spent = total_spent + v_price_paid,
         updated_at  = now()
   WHERE member_id = p_member_id;

  INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
  VALUES (
    p_member_id, -v_price_paid, v_balance - v_price_paid, 'shop_purchase',
    'shop_purchase', v_purchase_id::text,
    jsonb_build_object(
      'itemId',          v_item.id,
      'itemType',        v_item.type,
      'name',            v_item.name,
      'priceOriginal',   v_price_original,
      'discountApplied', v_discount
    )
  );

  IF v_item.stock IS NOT NULL THEN
    UPDATE shop_items
       SET stock = stock - 1, updated_at = now()
     WHERE id = v_item.id
     RETURNING stock INTO v_stock_after;
  ELSE
    v_stock_after := NULL;
  END IF;

  v_title_id := NULLIF(v_item.payload->>'title_id', '')::uuid;
  IF v_title_id IS NOT NULL THEN
    INSERT INTO member_titles (member_id, title_id, granted_at, reason)
    VALUES (p_member_id, v_title_id, now(), 'shop_purchase')
    ON CONFLICT (member_id, title_id) DO UPDATE
       SET revoked_at     = NULL,
           revoked_by     = NULL,
           revoked_reason = NULL;
  END IF;

  -- 스킨 부여 (payload.skin_id)
  v_skin_id := NULLIF(v_item.payload->>'skin_id', '');
  IF v_skin_id IS NOT NULL THEN
    INSERT INTO member_skins (member_id, skin_id, equipped)
    VALUES (p_member_id, v_skin_id, false)
    ON CONFLICT (member_id, skin_id) DO UPDATE SET revoked_at = NULL;
  END IF;

  -- 이펙트 기간제 부여/연장 (payload.effect_id + duration_days)
  IF v_effect_id IS NOT NULL THEN
    SELECT id, expires_at
      INTO v_effect_grant_id, v_effect_expires
      FROM member_title_effects
     WHERE member_id = p_member_id
       AND effect_id = v_effect_id
       AND revoked_at IS NULL
     FOR UPDATE;

    IF FOUND THEN
      IF v_effect_expires IS NULL THEN
        RAISE EXCEPTION 'already_owned';
      END IF;
      UPDATE member_title_effects
         SET expires_at = GREATEST(now(), expires_at) + make_interval(days => v_duration_days)
       WHERE id = v_effect_grant_id;
    ELSE
      INSERT INTO member_title_effects (member_id, effect_id, granted_at, reason, expires_at)
      VALUES (
        p_member_id,
        v_effect_id,
        now(),
        'shop_purchase',
        now() + make_interval(days => v_duration_days)
      );
    END IF;
  END IF;

  v_consumable_kind := NULLIF(v_item.payload->>'kind', '');
  IF v_consumable_kind IN ('nickname_change','rank_reset','spectator_lock','anonymity','magnifier','ban_eraser') THEN
    v_consumable_per := COALESCE((v_item.payload->>'stockPerUnit')::integer, 1);
    IF v_consumable_per <= 0 THEN v_consumable_per := 1; END IF;

    INSERT INTO shop_consumable_inventory(member_id, kind, count)
    VALUES (p_member_id, v_consumable_kind, v_consumable_per)
    ON CONFLICT (member_id, kind) DO UPDATE
       SET count = shop_consumable_inventory.count + EXCLUDED.count,
           updated_at = now();

    INSERT INTO shop_consumable_inventory_log(purchase_id, member_id, kind, delta)
    VALUES (v_purchase_id, p_member_id, v_consumable_kind, v_consumable_per)
    ON CONFLICT ON CONSTRAINT shop_consumable_inventory_log_pkey DO NOTHING;

    v_consumable_added := v_consumable_per;
  ELSE
    v_consumable_kind := NULL;
  END IF;

  RETURN QUERY SELECT
    v_purchase_id,
    v_balance - v_price_paid,
    v_price_paid,
    v_price_original,
    v_discount,
    v_stock_after,
    v_title_id,
    v_consumable_kind,
    v_consumable_added;
END;
$function$;
