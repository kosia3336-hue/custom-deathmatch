-- 길드 스카우트. 새 테이블·새 RPC. 기존 16개 RPC·기존 guild_* 파일은 안 고친다.
-- 1명당 50 GP. 실행: SQL Editor (guild_v4.sql 이후)

CREATE TABLE IF NOT EXISTS guild_scout_invites_v4 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  from_member_id uuid NOT NULL REFERENCES members(id),
  to_member_id uuid NOT NULL REFERENCES members(id),
  target_had_guild boolean NOT NULL,
  target_guild_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, to_member_id)
);
CREATE INDEX IF NOT EXISTS guild_scout_invites_v4_to_idx
  ON guild_scout_invites_v4 (to_member_id, created_at DESC);

ALTER TABLE guild_scout_invites_v4 ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION scout_guild_members_v4(p_actor uuid, p_targets uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_guild_name text;
  v_from_nick text;
  v_ids uuid[];
  v_tid uuid;
  v_target_guild uuid;
  v_target_role text;
  v_target_guild_name text;
  v_had boolean;
  v_invite uuid;
  v_n integer;
  v_cost integer;
  v_points bigint;
  v_invites jsonb := '[]'::jsonb;
  v_unit integer := 50;
BEGIN
  SELECT ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_targets, '{}')) AS x WHERE x IS NOT NULL)
    INTO v_ids;
  v_n := COALESCE(array_length(v_ids, 1), 0);
  IF v_n < 1 THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF v_n > 40 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT name INTO v_guild_name FROM guilds WHERE id = v_guild AND disbanded_at IS NULL;
  IF v_guild_name IS NULL THEN RAISE EXCEPTION 'guild_not_found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM members WHERE id = p_actor AND withdrawn_at IS NULL) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT nickname::text INTO v_from_nick FROM members WHERE id = p_actor;

  FOREACH v_tid IN ARRAY v_ids LOOP
    IF v_tid = p_actor THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
    IF NOT EXISTS (SELECT 1 FROM members WHERE id = v_tid AND withdrawn_at IS NULL) THEN
      RAISE EXCEPTION 'member_not_found';
    END IF;
    v_target_guild := NULL;
    v_target_role := NULL;
    v_target_guild_name := NULL;
    SELECT m.guild_id, m.role INTO v_target_guild, v_target_role FROM guild_v4_active_membership(v_tid) m;
    IF v_target_guild IS NOT NULL AND v_target_guild = v_guild THEN
      RAISE EXCEPTION 'same_guild';
    END IF;
    IF v_target_role = 'owner' THEN
      RAISE EXCEPTION 'target_is_owner';
    END IF;
    IF EXISTS (
      SELECT 1 FROM guild_scout_invites_v4 WHERE guild_id = v_guild AND to_member_id = v_tid
    ) THEN
      RAISE EXCEPTION 'already_scouted';
    END IF;
  END LOOP;

  v_cost := v_n * v_unit;
  SELECT points INTO v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;
  UPDATE guilds SET points = points - v_cost WHERE id = v_guild RETURNING points INTO v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason, ref)
  VALUES (v_guild, p_actor, -v_cost, 'scout', v_n::text);

  FOREACH v_tid IN ARRAY v_ids LOOP
    v_target_guild := NULL;
    v_target_role := NULL;
    v_target_guild_name := NULL;
    SELECT m.guild_id, m.role INTO v_target_guild, v_target_role FROM guild_v4_active_membership(v_tid) m;
    v_had := v_target_guild IS NOT NULL;
    IF v_had THEN
      SELECT name INTO v_target_guild_name FROM guilds WHERE id = v_target_guild;
    END IF;

    INSERT INTO guild_scout_invites_v4 (
      guild_id, from_member_id, to_member_id, target_had_guild, target_guild_name
    ) VALUES (v_guild, p_actor, v_tid, v_had, v_target_guild_name)
    RETURNING id INTO v_invite;

    INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
    VALUES (
      v_guild, p_actor, 'scout_sent',
      jsonb_build_object('target', v_tid, 'invite', v_invite)
    );

    v_invites := v_invites || jsonb_build_array(jsonb_build_object(
      'invite_id', v_invite,
      'guild_id', v_guild,
      'guild_name', v_guild_name,
      'from_nickname', v_from_nick,
      'to_member_id', v_tid,
      'target_had_guild', v_had,
      'target_guild_name', v_target_guild_name
    ));
  END LOOP;

  RETURN jsonb_build_object('invites', v_invites, 'new_gp', v_points);
END;
$$;

CREATE OR REPLACE FUNCTION scout_guild_member_v4(p_actor uuid, p_target uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT scout_guild_members_v4(p_actor, ARRAY[p_target]);
$$;

REVOKE ALL ON FUNCTION scout_guild_members_v4(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION scout_guild_member_v4(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION scout_guild_members_v4(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION scout_guild_member_v4(uuid, uuid) TO service_role;
