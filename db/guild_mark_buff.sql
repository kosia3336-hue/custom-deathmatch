-- ─────────────────────────────────────────────────────────────
-- 길드 확장: 길드 마크(이미지) + 길드 버프(CDP 수완 증가)
--   · 마크 등록/변경: 300 GP
--   · 버프 레벨업: 100 GP × 2^(현재레벨)  → 100/200/400/800/1600/3200/6400/12800/25600 (최대 9레벨)
--   · 버프 효과: 레벨당 CDP +1% (매 게임 적립 시 소켓 서버가 적용)
-- 실행: Supabase SQL Editor (db/guilds.sql 이후)
-- ─────────────────────────────────────────────────────────────

-- ── 컬럼 추가 ────────────────────────────────────────────────
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS mark_url text;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS buff_cdp_level int NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guilds_buff_cdp_level_chk'
  ) THEN
    ALTER TABLE guilds
      ADD CONSTRAINT guilds_buff_cdp_level_chk
      CHECK (buff_cdp_level BETWEEN 0 AND 9);
  END IF;
END $$;

-- ── 길드 마크 등록/변경 (300 GP) ─────────────────────────────
CREATE OR REPLACE FUNCTION set_guild_mark(p_owner uuid, p_url text)
RETURNS TABLE (mark_url text, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_cost bigint := 300;
  v_points bigint;
  v_url text;
BEGIN
  IF p_url IS NULL OR char_length(p_url) = 0 THEN
    RAISE EXCEPTION 'invalid_mark_url';
  END IF;

  SELECT gm.guild_id INTO v_guild
    FROM guild_members gm WHERE gm.member_id = p_owner AND gm.role = 'owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT points INTO v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;

  UPDATE guilds SET points = points - v_cost, mark_url = p_url
   WHERE id = v_guild RETURNING guilds.mark_url, points INTO v_url, v_points;

  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_owner, -v_cost, 'mark_purchase');

  RETURN QUERY SELECT v_url, v_points;
END;
$$;

-- ── 길드 버프(CDP 수완) 레벨업 ───────────────────────────────
--   비용: 100 × 2^(현재레벨). 최대 9레벨.
CREATE OR REPLACE FUNCTION buy_guild_buff(p_owner uuid)
RETURNS TABLE (new_level int, cost bigint, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_level int;
  v_cost bigint;
  v_points bigint;
BEGIN
  SELECT gm.guild_id INTO v_guild
    FROM guild_members gm WHERE gm.member_id = p_owner AND gm.role = 'owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT buff_cdp_level, points INTO v_level, v_points
    FROM guilds WHERE id = v_guild FOR UPDATE;

  IF v_level >= 9 THEN RAISE EXCEPTION 'buff_max_level'; END IF;

  v_cost := 100 * (2 ^ v_level)::bigint;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;

  UPDATE guilds
     SET points = points - v_cost,
         buff_cdp_level = buff_cdp_level + 1
   WHERE id = v_guild
   RETURNING buff_cdp_level, points INTO v_level, v_points;

  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_owner, -v_cost, 'buff_cdp_purchase');

  RETURN QUERY SELECT v_level, v_cost, v_points;
END;
$$;

-- ── 권한 ────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION set_guild_mark(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_guild_buff(uuid) FROM PUBLIC, anon, authenticated;
