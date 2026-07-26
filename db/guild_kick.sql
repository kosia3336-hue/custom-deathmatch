-- ─────────────────────────────────────────────────────────────
-- 길드 확장: 길드장/부길드장의 길드원 추방
--   · 길드장·부길드장 모두 추방 가능. 단, 길드장은 추방 대상이 될 수 없다.
--   · 본인은 추방 불가(탈퇴 이용).
-- 실행: Supabase SQL Editor (db/guilds.sql, db/guild_audit.sql 이후)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION kick_guild_member(p_actor uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_actor_role text;
  v_target_role text;
BEGIN
  SELECT guild_id, role INTO v_guild, v_actor_role FROM guild_members WHERE member_id = p_actor;
  IF NOT FOUND OR v_actor_role NOT IN ('owner', 'vice_owner') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_target = p_actor THEN
    RAISE EXCEPTION 'cannot_kick_self';
  END IF;

  SELECT role INTO v_target_role FROM guild_members WHERE guild_id = v_guild AND member_id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'cannot_kick_owner';
  END IF;

  DELETE FROM guild_members WHERE guild_id = v_guild AND member_id = p_target;

  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_target, 'kicked', jsonb_build_object('by', p_actor));
END;
$$;

REVOKE ALL ON FUNCTION kick_guild_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
