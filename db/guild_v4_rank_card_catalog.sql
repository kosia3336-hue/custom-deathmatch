-- 랭킹카드 카탈로그 10종. 오로라 제외 기존 구매 삭제 + 300 GP 환불.
-- 새 CHECK·buy_guild_rank_card_v4. 기존 16개 RPC·guilds ALTER 없음.
-- 실행: SQL Editor (guild_v4_rank_card.sql 이후)

WITH doomed AS (
  SELECT guild_id, skin_id, purchased_by
  FROM guild_rank_card_skins
  WHERE skin_id IS DISTINCT FROM 'aurora'
),
upd AS (
  UPDATE guilds g
  SET points = g.points + 300
  FROM doomed d
  WHERE g.id = d.guild_id
  RETURNING g.id
),
led AS (
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason, ref)
  SELECT d.guild_id, d.purchased_by, 300, 'rank_card_refund', d.skin_id
  FROM doomed d
  RETURNING id
),
aud AS (
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  SELECT
    d.guild_id,
    d.purchased_by,
    'refund_rank_card_v4',
    jsonb_build_object('removed_skin_id', d.skin_id, 'delta', 300)
  FROM doomed d
  RETURNING id
),
del AS (
  DELETE FROM guild_rank_card_skins
  WHERE skin_id IS DISTINCT FROM 'aurora'
  RETURNING guild_id
)
SELECT
  (SELECT count(*) FROM doomed) AS refunded_guilds,
  (SELECT count(*) FROM del) AS deleted_rows;

ALTER TABLE guild_rank_card_skins DROP CONSTRAINT IF EXISTS guild_rank_card_skins_skin_id_check;
ALTER TABLE guild_rank_card_skins ADD CONSTRAINT guild_rank_card_skins_skin_id_check
  CHECK (skin_id IN (
    'gilt', 'aurora', 'sakura', 'frost', 'jade',
    'yuzu', 'loess', 'woad', 'grape', 'ink'
  ));

CREATE OR REPLACE FUNCTION buy_guild_rank_card_v4(p_actor uuid, p_skin_id text)
RETURNS TABLE (skin_id text, expires_at timestamptz, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_cost bigint := 300;
  v_points bigint;
  v_skin text;
  v_exp timestamptz;
BEGIN
  IF p_skin_id IS NULL OR p_skin_id NOT IN (
    'gilt', 'aurora', 'sakura', 'frost', 'jade',
    'yuzu', 'loess', 'woad', 'grape', 'ink'
  ) THEN
    RAISE EXCEPTION 'invalid_skin';
  END IF;

  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT points INTO v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_points IS NULL THEN RAISE EXCEPTION 'guild_not_found'; END IF;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;

  UPDATE guilds SET points = points - v_cost WHERE id = v_guild RETURNING points INTO v_points;

  INSERT INTO guild_rank_card_skins (guild_id, skin_id, expires_at, purchased_at, purchased_by)
  VALUES (v_guild, p_skin_id, now() + interval '7 days', now(), p_actor)
  ON CONFLICT (guild_id) DO UPDATE SET
    skin_id = excluded.skin_id,
    expires_at = excluded.expires_at,
    purchased_at = excluded.purchased_at,
    purchased_by = excluded.purchased_by
  RETURNING guild_rank_card_skins.skin_id, guild_rank_card_skins.expires_at
    INTO v_skin, v_exp;

  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason, ref)
  VALUES (v_guild, p_actor, -v_cost, 'rank_card_purchase', p_skin_id);

  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (
    v_guild, p_actor, 'buy_rank_card_v4',
    jsonb_build_object('skin_id', p_skin_id, 'expires_at', v_exp)
  );

  RETURN QUERY SELECT v_skin, v_exp, v_points;
END;
$$;

REVOKE ALL ON FUNCTION buy_guild_rank_card_v4(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION buy_guild_rank_card_v4(uuid, text) TO service_role;
