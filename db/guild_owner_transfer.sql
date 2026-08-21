-- ============================================================
-- 길드장 위임 — 신규 RPC. 기존 16개 함수는 건드리지 않는다.
--   transfer_guild_owner(p_actor, p_target)
--     · 호출자(p_actor)가 길드장이어야 함
--     · 대상은 같은 길드 멤버, 본인 아님
--     · 액터 role → member, 대상 → owner, guilds.owner_id 갱신
-- 실행: Supabase SQL Editor (기존 guild_*.sql 이후)
-- ============================================================

CREATE OR REPLACE FUNCTION transfer_guild_owner(p_actor uuid, p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guild uuid;
  v_disbanded timestamptz;
BEGIN
  IF p_target IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_target = p_actor THEN
    RAISE EXCEPTION 'cannot_target_self';
  END IF;

  SELECT gm.guild_id, g.disbanded_at
    INTO v_guild, v_disbanded
    FROM guild_members gm
    JOIN guilds g ON g.id = gm.guild_id
   WHERE gm.member_id = p_actor AND gm.role = 'owner';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_disbanded IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM guild_members
     WHERE guild_id = v_guild AND member_id = p_target
  ) THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  UPDATE guild_members
     SET role = 'member'
   WHERE guild_id = v_guild AND member_id = p_actor;

  UPDATE guild_members
     SET role = 'owner'
   WHERE guild_id = v_guild AND member_id = p_target;

  UPDATE guilds
     SET owner_id = p_target
   WHERE id = v_guild AND disbanded_at IS NULL;

  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (
    v_guild,
    p_target,
    'owner_transferred',
    jsonb_build_object('from', p_actor, 'to', p_target)
  );
END;
$$;

REVOKE ALL ON FUNCTION transfer_guild_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;
