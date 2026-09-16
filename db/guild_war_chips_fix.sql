-- ============================================================
-- 길드전 공유 칩 — 정산 RPC 보정 (코드리뷰 반영).
-- 실행: SQL Editor. db/guild_war_chips.sql 이후.
-- 상태: 운영 적용 완료 (2026-09-16).
--
-- 0. **settle_guild_war_set 이 한 번도 성공한 적이 없던 버그를 고친다.**
--    `RETURNS TABLE (guild_id uuid, …)` 의 guild_id 가 PL/pgSQL 변수로 잡혀서
--    함수 안의 `ON CONFLICT (guild_id)` 가 42702 ambiguous 로 폭주했다.
--    서버가 정산 실패를 로그만 남기고 넘겨서 드러나지 않았다 (칩이 영원히 안 움직임).
--    ON CONFLICT 을 문장 분기로 바꿔 모호성 자체를 없앴다.
-- 1. settle_guild_war_set 을 set_id 기준 멱등으로 만든다 (GW-29).
--    네트워크 타임아웃 후 재시도해도 이중 지급이 없어야 정산 실패를 보정할 수 있다.
--    멱등은 EXISTS 검사가 담당하고, 동시 호출 경쟁은 유니크 인덱스가 막는다.
-- 2. 음수가 될 델타를 GREATEST(0, …) 로 깎지 않고 예외를 던져 롤백한다.
--    깎으면 잔액과 원장 합계가 영구히 어긋나고 계산 버그가 조용히 묻힌다.
-- 3. purchase_guild_war_chip_pack 에 guild_not_found 가드를 넣는다.
--
-- 기존 16개 RPC · 기존 guild_*.sql · guilds ALTER 는 건드리지 않는다.
-- 여기서 CREATE OR REPLACE 하는 둘은 길드전용 새 RPC 다.
-- ============================================================

-- ── 1. 원장에 세트 식별자 ─────────────────────────────────────
ALTER TABLE guild_war_chip_ledger ADD COLUMN IF NOT EXISTS set_id text;

-- 같은 세트·같은 길드는 한 줄만. 구매·환전 줄은 set_id 가 NULL 이라 제약을 타지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS guild_war_chip_ledger_set_uidx
  ON guild_war_chip_ledger(set_id, guild_id)
  WHERE set_id IS NOT NULL;

-- ── 2. 세트 정산 (멱등 + 음수 롤백) ───────────────────────────
--
-- `ON CONFLICT (guild_id)` 를 쓰면 안 된다. RETURNS TABLE 의 guild_id 가
-- PL/pgSQL 변수로 잡혀 42702 ambiguous 가 난다. 문장 분기로 대체한다.
CREATE OR REPLACE FUNCTION settle_guild_war_set(p_set_id text, p_entries jsonb)
RETURNS TABLE (guild_id uuid, new_balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_balance integer;
BEGIN
  IF p_set_id IS NULL OR btrim(p_set_id) = '' THEN
    RAISE EXCEPTION 'invalid_set_id';
  END IF;

  FOR r IN
    SELECT (e->>'guild_id')::uuid AS gid, (e->>'delta')::integer AS delta
      FROM jsonb_array_elements(COALESCE(p_entries, '[]'::jsonb)) e
     ORDER BY (e->>'guild_id')::uuid
  LOOP
    IF r.gid IS NULL OR r.delta IS NULL OR r.delta = 0 THEN CONTINUE; END IF;

    INSERT INTO guild_war_chips (guild_id, balance, updated_at)
    SELECT r.gid, 0, now()
     WHERE NOT EXISTS (SELECT 1 FROM guild_war_chips c WHERE c.guild_id = r.gid);

    -- 이미 정산한 세트라면 잔액만 돌려준다 (멱등).
    IF EXISTS (
      SELECT 1 FROM guild_war_chip_ledger l
       WHERE l.set_id = p_set_id AND l.guild_id = r.gid
    ) THEN
      SELECT c.balance INTO v_balance FROM guild_war_chips c WHERE c.guild_id = r.gid;
      guild_id := r.gid;
      new_balance := v_balance;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT c.balance INTO v_balance
      FROM guild_war_chips c
     WHERE c.guild_id = r.gid
       FOR UPDATE;

    -- 0으로 클램프하지 않는다. 음수가 나오면 엔진 계산이 틀린 것이므로 전체를 되돌린다.
    IF v_balance + r.delta < 0 THEN
      RAISE EXCEPTION 'guild_war_balance_underflow: guild=% balance=% delta=% set=%',
        r.gid, v_balance, r.delta, p_set_id;
    END IF;

    UPDATE guild_war_chips c
       SET balance = c.balance + r.delta, updated_at = now()
     WHERE c.guild_id = r.gid
     RETURNING c.balance INTO v_balance;

    INSERT INTO guild_war_chip_ledger (guild_id, member_id, delta, reason, set_id)
    VALUES (r.gid, NULL, r.delta, 'set:' || p_set_id, p_set_id);

    guild_id := r.gid;
    new_balance := v_balance;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ── 3. 팩 구매 (guild_not_found 가드) ─────────────────────────
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
  -- NULL 이면 `NULL < v_cost` 가 NULL 이라 잔액 검사를 통과해 버린다.
  IF v_points IS NULL THEN RAISE EXCEPTION 'guild_not_found'; END IF;
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

REVOKE ALL ON FUNCTION purchase_guild_war_chip_pack(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION settle_guild_war_set(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION purchase_guild_war_chip_pack(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION settle_guild_war_set(text, jsonb) TO service_role;
