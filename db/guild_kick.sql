-- ─────────────────────────────────────────────────────────────
-- 길드 확장: 길드장의 길드원 추방
-- 실행: Supabase SQL Editor (db/guilds.sql 이후)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION kick_guild_member(p_owner uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
BEGIN
  SELECT guild_id INTO v_guild FROM guild_members WHERE member_id = p_owner AND role = 'owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_target = p_owner THEN
    RAISE EXCEPTION 'cannot_kick_self';
  END IF;

  DELETE FROM guild_members WHERE guild_id = v_guild AND member_id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION kick_guild_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
