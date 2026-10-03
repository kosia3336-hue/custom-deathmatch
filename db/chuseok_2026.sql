-- 2026 한가위. 2026-09-27 21:00 KST ~ 2026-10-12 01:00 KST.
-- 랭크 송편, 공용 재고 상점, 기간이 끝나면 잔액 소멸.
-- 실행: Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.member_songpyeon (
  member_id uuid PRIMARY KEY REFERENCES public.members(id),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.songpyeon_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id),
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS songpyeon_ledger_idem
  ON public.songpyeon_ledger (member_id, reason, ref_id)
  WHERE ref_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.songpyeon_skin_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id),
  item_id uuid NOT NULL REFERENCES public.shop_items(id),
  status text NOT NULL CHECK (status IN ('pending', 'granted', 'refunded')),
  skin_id text,
  cost integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_songpyeon ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songpyeon_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songpyeon_skin_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_songpyeon_select_own ON public.member_songpyeon;
CREATE POLICY member_songpyeon_select_own ON public.member_songpyeon
  FOR SELECT TO authenticated USING (member_id = auth.uid());

DROP POLICY IF EXISTS songpyeon_ledger_select_own ON public.songpyeon_ledger;
CREATE POLICY songpyeon_ledger_select_own ON public.songpyeon_ledger
  FOR SELECT TO authenticated USING (member_id = auth.uid());

DROP POLICY IF EXISTS songpyeon_skin_grants_select_own ON public.songpyeon_skin_grants;
CREATE POLICY songpyeon_skin_grants_select_own ON public.songpyeon_skin_grants
  FOR SELECT TO authenticated USING (member_id = auth.uid());

CREATE OR REPLACE FUNCTION public.chuseok_2026_open(p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_now >= timestamptz '2026-09-27 21:00:00+09'
     AND p_now <  timestamptz '2026-10-12 01:00:00+09';
$$;

CREATE OR REPLACE FUNCTION public.burn_songpyeon_if_ended(p_member_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer;
BEGIN
  INSERT INTO member_songpyeon(member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  SELECT balance INTO v_balance FROM member_songpyeon WHERE member_id = p_member_id FOR UPDATE;
  IF public.chuseok_2026_open() OR v_balance = 0 THEN
    RETURN v_balance;
  END IF;
  UPDATE member_songpyeon SET balance = 0, updated_at = now() WHERE member_id = p_member_id;
  INSERT INTO songpyeon_ledger (member_id, delta, balance_after, reason, ref_id)
  VALUES (p_member_id, -v_balance, 0, 'event_end', 'chuseok-2026')
  ON CONFLICT (member_id, reason, ref_id) WHERE ref_id IS NOT NULL DO NOTHING;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_songpyeon_for_rank(
  p_member_id uuid,
  p_game_log_id uuid,
  p_amount integer,
  p_reason text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN public.burn_songpyeon_if_ended(p_member_id);
  END IF;
  IF p_amount NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'invalid_songpyeon_amount';
  END IF;
  IF NOT public.chuseok_2026_open() THEN
    RETURN public.burn_songpyeon_if_ended(p_member_id);
  END IF;
  PERFORM public.burn_songpyeon_if_ended(p_member_id);
  INSERT INTO member_songpyeon(member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
  SELECT balance INTO v_balance FROM member_songpyeon WHERE member_id = p_member_id FOR UPDATE;
  BEGIN
    INSERT INTO songpyeon_ledger (member_id, delta, balance_after, reason, ref_id)
    VALUES (p_member_id, p_amount, v_balance + p_amount, p_reason, p_game_log_id::text);
  EXCEPTION WHEN unique_violation THEN
    RETURN v_balance;
  END;
  UPDATE member_songpyeon
     SET balance = balance + p_amount, updated_at = now()
   WHERE member_id = p_member_id
   RETURNING balance INTO v_balance;
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_songpyeon_item(
  p_member_id uuid,
  p_item_id uuid,
  p_quantity integer DEFAULT 1
) RETURNS TABLE(
  purchase_id uuid,
  songpyeon_balance integer,
  price_paid integer,
  stock_after integer,
  grant_kind text,
  pending_id uuid,
  skin_id text,
  new_cdp_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_item record;
  v_qty integer := GREATEST(1, COALESCE(p_quantity, 1));
  v_cost integer;
  v_balance integer;
  v_purchase_id uuid;
  v_stock integer;
  v_grant text;
  v_pending uuid;
  v_skin text;
  v_cdp integer;
  v_exchange integer;
  v_title uuid;
  v_effect uuid;
  v_pool text[] := ARRAY[
    'skin-g003-01','skin-g001-01','skin-g002-01','skin-g004-01','skin-g010-01',
    'skin-g012-01','skin-g014-01','skin-g017-01','skin-g011-01','skin-g009-01','skin-g023-01','skin-g007-01'
  ];
BEGIN
  -- 반환 컬럼 skin_id, price_paid 가 테이블 컬럼과 이름이 같다.
  -- 함수 맨 위의 #variable_conflict use_column 이 없으면 구매가 바로 죽는다.
  IF NOT public.chuseok_2026_open() THEN
    PERFORM public.burn_songpyeon_if_ended(p_member_id);
    RAISE EXCEPTION 'item_expired';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM members m
    JOIN members_private p ON p.member_id = m.id
    WHERE m.id = p_member_id AND m.withdrawn_at IS NULL AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'member_not_active';
  END IF;

  SELECT * INTO v_item FROM shop_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF COALESCE(v_item.payload->>'priceUnit', '') <> 'songpyeon' THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF NOT v_item.is_active THEN RAISE EXCEPTION 'item_inactive'; END IF;
  IF v_item.available_from IS NOT NULL AND now() < v_item.available_from THEN RAISE EXCEPTION 'item_not_available_yet'; END IF;
  IF v_item.available_until IS NOT NULL AND now() >= v_item.available_until THEN RAISE EXCEPTION 'item_expired'; END IF;

  v_grant := NULLIF(v_item.payload->>'grant', '');
  v_exchange := NULLIF(v_item.payload->>'exchangeCdp', '')::integer;
  IF v_exchange IS NULL THEN
    v_qty := 1;
  END IF;
  IF v_item.stock IS NOT NULL AND v_item.stock < v_qty THEN RAISE EXCEPTION 'out_of_stock'; END IF;

  v_title := NULLIF(v_item.payload->>'title_id', '')::uuid;
  IF v_title IS NOT NULL AND EXISTS (
    SELECT 1 FROM member_titles
     WHERE member_id = p_member_id AND title_id = v_title AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;
  v_effect := NULLIF(v_item.payload->>'effect_id', '')::uuid;
  IF v_effect IS NOT NULL AND EXISTS (
    SELECT 1 FROM member_title_effects
     WHERE member_id = p_member_id AND effect_id = v_effect
       AND revoked_at IS NULL AND expires_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;
  v_skin := NULLIF(v_item.payload->>'skin_id', '');
  IF v_skin IS NOT NULL AND EXISTS (
    SELECT 1 FROM member_skins ms
     WHERE ms.member_id = p_member_id AND ms.skin_id = v_skin AND ms.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  v_cost := v_item.price * v_qty;
  PERFORM public.burn_songpyeon_if_ended(p_member_id);
  SELECT balance INTO v_balance FROM member_songpyeon WHERE member_id = p_member_id FOR UPDATE;
  IF COALESCE(v_balance, 0) < v_cost THEN RAISE EXCEPTION 'insufficient_songpyeon'; END IF;

  IF v_grant IN ('skin-pick', 'skin-random') THEN
    IF NOT EXISTS (
      SELECT 1 FROM unnest(v_pool) AS s(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM member_skins ms
        WHERE ms.member_id = p_member_id AND ms.skin_id = s.id AND ms.revoked_at IS NULL
      )
    ) THEN
      RAISE EXCEPTION 'no_skins_left';
    END IF;
  END IF;

  INSERT INTO shop_purchases (member_id, item_id, price_paid, payload_snapshot, name_snapshot, type_snapshot)
  VALUES (p_member_id, p_item_id, v_cost, v_item.payload, v_item.name, v_item.type)
  RETURNING id INTO v_purchase_id;

  UPDATE member_songpyeon
     SET balance = balance - v_cost, updated_at = now()
   WHERE member_id = p_member_id
   RETURNING balance INTO v_balance;
  INSERT INTO songpyeon_ledger (member_id, delta, balance_after, reason, ref_id)
  VALUES (p_member_id, -v_cost, v_balance, 'shop_purchase', v_purchase_id::text);

  IF v_item.stock IS NOT NULL THEN
    UPDATE shop_items SET stock = stock - v_qty, updated_at = now()
     WHERE id = v_item.id RETURNING stock INTO v_stock;
  END IF;

  v_title := NULLIF(v_item.payload->>'title_id', '')::uuid;
  IF v_title IS NOT NULL THEN
    INSERT INTO member_titles (member_id, title_id, granted_at, reason)
    VALUES (p_member_id, v_title, now(), 'shop_purchase')
    ON CONFLICT (member_id, title_id) DO UPDATE
      SET revoked_at = NULL, revoked_by = NULL, revoked_reason = NULL;
  END IF;

  v_effect := NULLIF(v_item.payload->>'effect_id', '')::uuid;
  IF v_effect IS NOT NULL THEN
    INSERT INTO member_title_effects (member_id, effect_id, granted_at, reason, expires_at)
    VALUES (p_member_id, v_effect, now(), 'shop_purchase', NULL);
  END IF;

  v_skin := NULLIF(v_item.payload->>'skin_id', '');
  IF v_skin IS NOT NULL THEN
    INSERT INTO member_skins (member_id, skin_id, equipped)
    VALUES (p_member_id, v_skin, false)
    ON CONFLICT (member_id, skin_id) DO UPDATE SET revoked_at = NULL;
  END IF;

  IF v_exchange IS NOT NULL THEN
    INSERT INTO member_cdp(member_id) VALUES (p_member_id) ON CONFLICT DO NOTHING;
    UPDATE member_cdp
       SET balance = balance + (v_exchange * v_qty),
           total_earned = total_earned + (v_exchange * v_qty),
           updated_at = now()
     WHERE member_id = p_member_id
     RETURNING balance INTO v_cdp;
    INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
    VALUES (
      p_member_id, v_exchange * v_qty, v_cdp, 'songpyeon_exchange',
      'shop_purchase', v_purchase_id::text,
      jsonb_build_object('songpyeon', v_qty, 'rate', v_exchange)
    );
  END IF;

  IF v_grant = 'skin-random' THEN
    SELECT s.id INTO v_skin
      FROM unnest(v_pool) AS s(id)
     WHERE NOT EXISTS (
       SELECT 1 FROM member_skins ms
       WHERE ms.member_id = p_member_id AND ms.skin_id = s.id AND ms.revoked_at IS NULL
     )
     ORDER BY random()
     LIMIT 1;
    INSERT INTO member_skins (member_id, skin_id, equipped)
    VALUES (p_member_id, v_skin, false)
    ON CONFLICT (member_id, skin_id) DO UPDATE SET revoked_at = NULL;
    INSERT INTO songpyeon_skin_grants (member_id, item_id, status, skin_id, cost)
    VALUES (p_member_id, p_item_id, 'granted', v_skin, v_cost)
    RETURNING id INTO v_pending;
  ELSIF v_grant = 'skin-pick' THEN
    INSERT INTO songpyeon_skin_grants (member_id, item_id, status, cost)
    VALUES (p_member_id, p_item_id, 'pending', v_cost)
    RETURNING id INTO v_pending;
  END IF;

  RETURN QUERY SELECT v_purchase_id, v_balance, v_cost, v_stock, v_grant, v_pending, v_skin, v_cdp;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_songpyeon_skin(
  p_member_id uuid,
  p_pending_id uuid,
  p_skin_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row songpyeon_skin_grants%ROWTYPE;
  v_pool text[] := ARRAY[
    'skin-g003-01','skin-g001-01','skin-g002-01','skin-g004-01','skin-g010-01',
    'skin-g012-01','skin-g014-01','skin-g017-01','skin-g011-01','skin-g009-01','skin-g023-01','skin-g007-01'
  ];
BEGIN
  SELECT * INTO v_row FROM songpyeon_skin_grants WHERE id = p_pending_id FOR UPDATE;
  IF NOT FOUND OR v_row.member_id <> p_member_id OR v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;
  IF NOT (p_skin_id = ANY (v_pool)) THEN RAISE EXCEPTION 'invalid_request'; END IF;
  IF EXISTS (
    SELECT 1 FROM member_skins
    WHERE member_id = p_member_id AND skin_id = p_skin_id AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;
  INSERT INTO member_skins (member_id, skin_id, equipped)
  VALUES (p_member_id, p_skin_id, false)
  ON CONFLICT (member_id, skin_id) DO UPDATE SET revoked_at = NULL;
  UPDATE songpyeon_skin_grants SET status = 'granted', skin_id = p_skin_id WHERE id = p_pending_id;
  RETURN p_skin_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_songpyeon_skin_pick(
  p_member_id uuid,
  p_pending_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row songpyeon_skin_grants%ROWTYPE;
  v_balance integer;
BEGIN
  SELECT * INTO v_row FROM songpyeon_skin_grants WHERE id = p_pending_id FOR UPDATE;
  IF NOT FOUND OR v_row.member_id <> p_member_id OR v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;
  UPDATE songpyeon_skin_grants SET status = 'refunded' WHERE id = p_pending_id;
  UPDATE shop_items SET stock = stock + 1, updated_at = now()
   WHERE id = v_row.item_id AND stock IS NOT NULL;
  IF public.chuseok_2026_open() THEN
    UPDATE member_songpyeon SET balance = balance + v_row.cost, updated_at = now()
     WHERE member_id = p_member_id
     RETURNING balance INTO v_balance;
    INSERT INTO songpyeon_ledger (member_id, delta, balance_after, reason, ref_id)
    VALUES (p_member_id, v_row.cost, v_balance, 'shop_refund', p_pending_id::text);
  ELSE
    v_balance := public.burn_songpyeon_if_ended(p_member_id);
  END IF;
  RETURN v_balance;
END;
$$;

-- 칭호
INSERT INTO titles (id, name, color, description, condition_text, is_system, is_legend, effect, is_active)
VALUES
  ('a1000001-2026-4000-8000-000000000001', '한가위', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000002', '송편', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000003', '달토끼', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000004', '달구경', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000005', '강강술래', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000006', '풍년', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000007', '차례', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000008', '보름달', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true),
  ('a1000001-2026-4000-8000-000000000009', '송편도둑', 'gold', '2026 한가위 칭호.', '한가위 상점', false, false, NULL, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO title_effect_defs (id, key, name, description, css_class, is_active)
VALUES
  ('b1000001-2026-4000-8000-000000000001', 'bokjumeoni', '복주머니', '영구 이펙트.', 'title-bokjumeoni', true),
  ('b1000001-2026-4000-8000-000000000002', 'hanji', '한지', '영구 이펙트.', 'title-hanji', true),
  ('b1000001-2026-4000-8000-000000000003', 'daltokki', '달토끼', '영구 이펙트.', 'title-daltokki', true),
  ('b1000001-2026-4000-8000-000000000004', 'nakyeop', '가을낙엽', '영구 이펙트.', 'title-nakyeop', true),
  ('b1000001-2026-4000-8000-000000000005', 'fullmoon', '풍요한가위', '영구 이펙트.', 'title-fullmoon', true)
ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, name = EXCLUDED.name, is_active = true;

INSERT INTO skins (id, game_id, name, description, is_active)
VALUES (
  'skin-g013-chuseok', 'game-013', '한가위 보름', '해달별2 한가위 보름 영구 스킨.', true
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO shop_items (
  id, type, name, description, price, stock, is_active, is_limited, payload,
  available_from, available_until, sort_order
)
VALUES
  ('c1000001-2026-4000-8000-000000000001', 'title', '한가위', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000001"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 190),
  ('c1000001-2026-4000-8000-000000000002', 'title', '송편', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000002"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 189),
  ('c1000001-2026-4000-8000-000000000003', 'title', '달토끼', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000003"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 188),
  ('c1000001-2026-4000-8000-000000000004', 'title', '달구경', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000004"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 187),
  ('c1000001-2026-4000-8000-000000000005', 'title', '강강술래', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000005"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 186),
  ('c1000001-2026-4000-8000-000000000006', 'title', '풍년', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000006"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 185),
  ('c1000001-2026-4000-8000-000000000007', 'title', '차례', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000007"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 184),
  ('c1000001-2026-4000-8000-000000000008', 'title', '보름달', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000008"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 183),
  ('c1000001-2026-4000-8000-000000000009', 'title', '송편도둑', '영구 칭호.', 80, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"unique":true,"title_id":"a1000001-2026-4000-8000-000000000009"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 182),
  ('c1000001-2026-4000-8000-000000000011', 'effect', '복주머니', '영구 이펙트.', 300, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"effect_id":"b1000001-2026-4000-8000-000000000001"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 170),
  ('c1000001-2026-4000-8000-000000000012', 'effect', '한지', '영구 이펙트.', 300, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"effect_id":"b1000001-2026-4000-8000-000000000002"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 169),
  ('c1000001-2026-4000-8000-000000000013', 'effect', '달토끼', '영구 이펙트.', 300, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"effect_id":"b1000001-2026-4000-8000-000000000003"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 168),
  ('c1000001-2026-4000-8000-000000000014', 'effect', '가을낙엽', '영구 이펙트.', 300, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"effect_id":"b1000001-2026-4000-8000-000000000004"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 167),
  ('c1000001-2026-4000-8000-000000000015', 'effect', '풍요한가위', '영구 이펙트.', 400, 1, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"effect_id":"b1000001-2026-4000-8000-000000000005"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 166),
  ('c1000001-2026-4000-8000-000000000021', 'skin', '해달별2 · 한가위 보름', '해달별2 영구 스킨.', 450, 3, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"skin_id":"skin-g013-chuseok"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 150),
  ('c1000001-2026-4000-8000-000000000022', 'skin', '스킨 영구 선택권', '가지고 있지 않은 스킨 중 하나를 선택하여 영구적으로 획득할 수 있다. (한정판 제외)', 450, 5, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"grant":"skin-pick"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 149),
  ('c1000001-2026-4000-8000-000000000023', 'skin', '스킨 영구 랜덤권', '가지고 있지 않은 스킨 중 하나 랜덤으로 획득할 수 있다. (한정판 제외)', 350, 10, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"grant":"skin-random"}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 148),
  ('c1000001-2026-4000-8000-000000000031', 'exchange', '송편 환전', '1송편을 3CDP로 교환한다.', 1, 10000, true, true,
    '{"priceUnit":"songpyeon","no_discount":true,"exchangeCdp":3}'::jsonb,
    timestamptz '2026-09-27 21:00:00+09', timestamptz '2026-10-12 01:00:00+09', 110)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  payload = EXCLUDED.payload,
  available_from = EXCLUDED.available_from,
  available_until = EXCLUDED.available_until,
  is_active = true;

GRANT EXECUTE ON FUNCTION public.chuseok_2026_open(timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.burn_songpyeon_if_ended(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_songpyeon_for_rank(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_songpyeon_item(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_songpyeon_skin(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_songpyeon_skin_pick(uuid, uuid) TO service_role;

COMMIT;
