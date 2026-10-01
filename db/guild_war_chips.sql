-- ============================================================
-- 길드전 공유 칩 — 새 테이블·새 RPC.
-- 기존 16개 RPC · 기존 guild_* 파일 · guilds ALTER 는 하지 않는다.
-- 실행: SQL Editor (기존 guild_*.sql · guild_v4*.sql 이후)
-- 팩: 칩 10개 = 100 GP. 구매는 길드장·부길드장.
-- ============================================================

CREATE TABLE IF NOT EXISTS guild_war_chips (
  guild_id   uuid PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  balance    integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guild_war_chip_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id   uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  member_id  uuid REFERENCES members(id),
  delta      integer NOT NULL,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_war_chip_ledger_guild_idx
  ON guild_war_chip_ledger(guild_id, created_at DESC);

ALTER TABLE guild_war_chips ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_war_chip_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guild_war_chips_read ON guild_war_chips;
CREATE POLICY guild_war_chips_read ON guild_war_chips FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_war_chip_ledger_read ON guild_war_chip_ledger;
CREATE POLICY guild_war_chip_ledger_read ON guild_war_chip_ledger FOR SELECT USING (true);

GRANT SELECT ON guild_war_chips TO anon, authenticated, service_role;
GRANT SELECT ON guild_war_chip_ledger TO anon, authenticated, service_role;

-- 1팩 = 10칩 / 100 GP. p_qty = 팩 수(1~99). 세트 정산·종료 환전 RPC는 별도.
DROP FUNCTION IF EXISTS purchase_guild_war_chip_pack(uuid);

CREATE OR REPLACE FUNCTION purchase_guild_war_chip_pack(p_actor uuid, p_qty integer)
RETURNS TABLE (chips integer, cost integer, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_points bigint;
  v_chips integer;
  v_cost integer;
  v_pack integer;
BEGIN
  IF p_qty IS NULL OR p_qty < 1 OR p_qty > 99 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_cost := 100 * p_qty;
  v_pack := 10 * p_qty;

  SELECT points INTO v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;

  INSERT INTO guild_war_chips (guild_id, balance, updated_at)
  VALUES (v_guild, 0, now())
  ON CONFLICT (guild_id) DO NOTHING;

  UPDATE guilds SET points = points - v_cost
   WHERE id = v_guild
   RETURNING points INTO v_points;

  UPDATE guild_war_chips
     SET balance = balance + v_pack, updated_at = now()
   WHERE guild_id = v_guild
   RETURNING balance INTO v_chips;

  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_actor, -v_cost, 'war_chip_pack');
  INSERT INTO guild_war_chip_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_actor, v_pack, 'pack_purchase');
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (
    v_guild,
    p_actor,
    'war_chip_pack',
    jsonb_build_object('qty', p_qty, 'chips', v_pack, 'balance', v_chips, 'cost', v_cost)
  );

  RETURN QUERY SELECT v_chips, v_cost, v_points;
END;
$$;

-- 세트 1회 정산. 길드 단위 델타를 한 트랜잭션에 적용한다.
-- p_entries = [{"guild_id": uuid, "delta": int}, ...]
CREATE OR REPLACE FUNCTION settle_guild_war_set(p_set_id text, p_entries jsonb)
RETURNS TABLE (guild_id uuid, new_balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_balance integer;
BEGIN
  FOR r IN
    SELECT (e->>'guild_id')::uuid AS gid, (e->>'delta')::integer AS delta
      FROM jsonb_array_elements(COALESCE(p_entries, '[]'::jsonb)) e
     ORDER BY (e->>'guild_id')::uuid
  LOOP
    IF r.gid IS NULL OR r.delta IS NULL OR r.delta = 0 THEN CONTINUE; END IF;

    INSERT INTO guild_war_chips (guild_id, balance, updated_at)
    VALUES (r.gid, 0, now())
    ON CONFLICT (guild_id) DO NOTHING;

    UPDATE guild_war_chips
       SET balance = GREATEST(0, balance + r.delta), updated_at = now()
     WHERE guild_war_chips.guild_id = r.gid
     RETURNING balance INTO v_balance;

    INSERT INTO guild_war_chip_ledger (guild_id, member_id, delta, reason)
    VALUES (r.gid, NULL, r.delta, 'set:' || COALESCE(p_set_id, ''));

    guild_id := r.gid;
    new_balance := v_balance;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 기간 종료 자동 환전. 남은 칩 1개당 8 GP (수수료 20%). 반복 호출해도 안전하다.
CREATE OR REPLACE FUNCTION expire_guild_war_chips()
RETURNS TABLE (guild_id uuid, chips integer, gp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_gp integer;
BEGIN
  FOR r IN
    SELECT c.guild_id AS gid, c.balance AS bal
      FROM guild_war_chips c
      JOIN guilds g ON g.id = c.guild_id
     WHERE c.balance > 0
     FOR UPDATE OF c
  LOOP
    v_gp := floor(r.bal * 8)::integer;

    UPDATE guild_war_chips
       SET balance = 0, updated_at = now()
     WHERE guild_war_chips.guild_id = r.gid;

    UPDATE guilds SET points = points + v_gp WHERE id = r.gid;

    INSERT INTO guild_war_chip_ledger (guild_id, member_id, delta, reason)
    VALUES (r.gid, NULL, -r.bal, 'period_refund');
    INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
    VALUES (r.gid, NULL, v_gp, 'war_chip_refund');
    INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
    VALUES (r.gid, NULL, 'war_chip_refund', jsonb_build_object('chips', r.bal, 'gp', v_gp));

    guild_id := r.gid;
    chips := r.bal;
    gp := v_gp;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION purchase_guild_war_chip_pack(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION settle_guild_war_set(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION expire_guild_war_chips() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purchase_guild_war_chip_pack(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION settle_guild_war_set(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION expire_guild_war_chips() TO service_role;
