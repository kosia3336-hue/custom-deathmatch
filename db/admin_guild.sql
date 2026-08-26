-- ============================================================
-- 관리자 길드 — 신규 RPC. 기존 16개 길드 함수는 건드리지 않는다.
--   admin_guild_act(p_actor_id, p_action, p_guild_id, p_payload)
-- 실행: Supabase SQL Editor (기존 guild_*.sql 이후)
-- ============================================================

CREATE OR REPLACE FUNCTION admin_guild_act(
  p_actor_id uuid,
  p_action text,
  p_guild_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disbanded timestamptz;
  v_points bigint;
  v_next bigint;
  v_applied bigint;
  v_clamped boolean := false;
  v_delta bigint;
  v_reason text;
  v_target uuid;
  v_role text;
  v_name text;
  v_desc text;
  v_logo text;
  v_url text;
  v_cap int;
  v_members int;
  v_req uuid;
  v_approve boolean;
  v_req_guild uuid;
  v_req_member uuid;
  v_notify uuid[] := ARRAY[]::uuid[];
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF p_actor_id IS NULL OR NOT public.is_admin(p_actor_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_action IS NULL OR p_action = '' THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  IF p_guild_id IS NULL THEN
    RAISE EXCEPTION 'guild_not_found';
  END IF;

  SELECT disbanded_at, points, name, description, capacity, mark_url
    INTO v_disbanded, v_points, v_name, v_desc, v_cap, v_url
    FROM guilds
   WHERE id = p_guild_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guild_not_found';
  END IF;

  SELECT coalesce(array_agg(member_id), ARRAY[]::uuid[])
    INTO v_notify
    FROM guild_members
   WHERE guild_id = p_guild_id;

  IF p_action <> 'disband' AND v_disbanded IS NOT NULL THEN
    RAISE EXCEPTION 'guild_disbanded';
  END IF;

  CASE p_action
    WHEN 'adjust_gp' THEN
      v_delta := (p_payload->>'delta')::bigint;
      v_reason := btrim(coalesce(p_payload->>'reason', ''));
      IF v_delta IS NULL OR v_delta = 0 THEN RAISE EXCEPTION 'delta_zero'; END IF;
      IF v_delta < -100000 OR v_delta > 100000 THEN RAISE EXCEPTION 'delta_out_of_range'; END IF;
      IF char_length(v_reason) < 3 OR char_length(v_reason) > 200 THEN RAISE EXCEPTION 'reason_invalid'; END IF;
      v_next := v_points + v_delta;
      IF v_next < 0 THEN
        v_applied := -v_points;
        v_next := 0;
        v_clamped := true;
      ELSE
        v_applied := v_delta;
      END IF;
      UPDATE guilds SET points = v_next WHERE id = p_guild_id;
      IF v_applied <> 0 THEN
        INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason, ref)
        VALUES (p_guild_id, p_actor_id, v_applied, 'admin_adjust', p_actor_id::text);
      END IF;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.adjust_gp', 'member', p_guild_id::text,
        jsonb_build_object(
          'requested_delta', v_delta, 'applied_delta', v_applied,
          'clamped', v_clamped, 'before', v_points, 'after', v_next, 'reason', v_reason
        )
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, p_actor_id, 'admin_adjust_gp', jsonb_build_object('delta', v_applied, 'reason', v_reason));
      v_result := jsonb_build_object('points', v_next, 'appliedDelta', v_applied, 'clamped', v_clamped);

    WHEN 'kick' THEN
      v_target := (p_payload->>'targetMemberId')::uuid;
      IF v_target IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
      SELECT role INTO v_role FROM guild_members
       WHERE guild_id = p_guild_id AND member_id = v_target;
      IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;
      IF v_role = 'owner' THEN RAISE EXCEPTION 'cannot_kick_owner'; END IF;
      DELETE FROM guild_members WHERE guild_id = p_guild_id AND member_id = v_target;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.kick', 'member', v_target::text,
        jsonb_build_object('guildId', p_guild_id)
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, v_target, 'admin_kicked', jsonb_build_object('by', p_actor_id));
      v_notify := ARRAY[v_target];
      v_result := jsonb_build_object('kicked', v_target);

    WHEN 'disband' THEN
      v_reason := btrim(coalesce(p_payload->>'reason', ''));
      IF char_length(v_reason) < 3 OR char_length(v_reason) > 200 THEN RAISE EXCEPTION 'reason_invalid'; END IF;
      IF v_disbanded IS NOT NULL THEN RAISE EXCEPTION 'guild_disbanded'; END IF;
      DELETE FROM guild_members WHERE guild_id = p_guild_id;
      UPDATE guild_join_requests
         SET status = 'canceled', decided_at = now()
       WHERE guild_id = p_guild_id AND status = 'pending';
      UPDATE guilds SET disbanded_at = now() WHERE id = p_guild_id AND disbanded_at IS NULL;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.disband', 'member', p_guild_id::text,
        jsonb_build_object('reason', v_reason, 'memberIds', to_jsonb(v_notify))
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, p_actor_id, 'admin_disband', jsonb_build_object('reason', v_reason));
      v_result := jsonb_build_object('disbanded', true);

    WHEN 'set_vice' THEN
      v_target := (p_payload->>'targetMemberId')::uuid;
      IF v_target IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
      SELECT role INTO v_role FROM guild_members
       WHERE guild_id = p_guild_id AND member_id = v_target;
      IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;
      IF v_role = 'owner' THEN RAISE EXCEPTION 'cannot_target_owner'; END IF;
      IF coalesce((p_payload->>'promote')::boolean, false) THEN
        UPDATE guild_members SET role = 'vice_owner'
         WHERE guild_id = p_guild_id AND member_id = v_target;
      ELSE
        UPDATE guild_members SET role = 'member'
         WHERE guild_id = p_guild_id AND member_id = v_target;
      END IF;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.set_vice', 'member', v_target::text,
        jsonb_build_object('guildId', p_guild_id, 'promote', coalesce((p_payload->>'promote')::boolean, false))
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, v_target, 'admin_set_vice', p_payload);
      v_notify := ARRAY[v_target];
      v_result := jsonb_build_object('targetMemberId', v_target);

    WHEN 'transfer_owner' THEN
      v_target := (p_payload->>'targetMemberId')::uuid;
      IF v_target IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM guild_members WHERE guild_id = p_guild_id AND member_id = v_target
      ) THEN
        RAISE EXCEPTION 'member_not_found';
      END IF;
      UPDATE guild_members SET role = 'member'
       WHERE guild_id = p_guild_id AND role = 'owner';
      UPDATE guild_members SET role = 'owner'
       WHERE guild_id = p_guild_id AND member_id = v_target;
      UPDATE guilds SET owner_id = v_target WHERE id = p_guild_id;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.transfer_owner', 'member', v_target::text,
        jsonb_build_object('guildId', p_guild_id)
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, v_target, 'admin_owner_transferred', jsonb_build_object('by', p_actor_id));
      v_notify := ARRAY[v_target];
      v_result := jsonb_build_object('ownerId', v_target);

    WHEN 'set_profile' THEN
      IF p_payload ? 'name' THEN
        v_name := btrim(p_payload->>'name');
        IF char_length(v_name) < 2 OR char_length(v_name) > 20 OR v_name !~ '^[A-Za-z가-힣]+$' THEN
          RAISE EXCEPTION 'invalid_name_chars';
        END IF;
        IF EXISTS (
          SELECT 1 FROM guilds WHERE name = v_name AND id <> p_guild_id
        ) THEN
          RAISE EXCEPTION 'name_taken';
        END IF;
        UPDATE guilds SET name = v_name WHERE id = p_guild_id;
      END IF;
      IF p_payload ? 'description' THEN
        v_desc := left(btrim(coalesce(p_payload->>'description', '')), 200);
        UPDATE guilds SET description = v_desc WHERE id = p_guild_id;
      END IF;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (p_actor_id, 'guild.set_profile', 'member', p_guild_id::text, p_payload);
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, p_actor_id, 'admin_set_profile', p_payload);
      v_result := jsonb_build_object('name', v_name, 'description', v_desc);

    WHEN 'set_mark' THEN
      v_logo := p_payload->>'logoId';
      IF v_logo IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          'crown','shield','sword','dual-swords','axe','spear','bow','star','moon','sun',
          'lightning','flame','wave','rose','skull','dragon','wolf','tiger','eagle','lion',
          'bear','stag','fox','owl','snake','rabbit','phoenix','griffin','raven','panther',
          'hydra','falcon','scorpion','ram','horse','boar','kraken','hammer','trident','helm',
          'castle','gem','eye','mask','comet','crystal','ship','dagger'
        ]) AS x(id) WHERE x.id = v_logo
      ) THEN
        RAISE EXCEPTION 'invalid_logo';
      END IF;
      v_url := '/guild/logos/' || v_logo || '.png';
      UPDATE guilds SET mark_url = v_url WHERE id = p_guild_id;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.set_mark', 'member', p_guild_id::text,
        jsonb_build_object('logoId', v_logo, 'markUrl', v_url)
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, p_actor_id, 'admin_set_mark', jsonb_build_object('logoId', v_logo));
      v_result := jsonb_build_object('markUrl', v_url);

    WHEN 'set_capacity' THEN
      v_cap := (p_payload->>'capacity')::int;
      SELECT count(*) INTO v_members FROM guild_members WHERE guild_id = p_guild_id;
      IF v_cap IS NULL OR v_cap < 3 OR v_cap > 30 THEN RAISE EXCEPTION 'invalid_capacity'; END IF;
      IF v_cap < v_members THEN RAISE EXCEPTION 'capacity_below_members'; END IF;
      UPDATE guilds SET capacity = v_cap WHERE id = p_guild_id;
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.set_capacity', 'member', p_guild_id::text,
        jsonb_build_object('capacity', v_cap, 'memberCount', v_members)
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, p_actor_id, 'admin_set_capacity', jsonb_build_object('capacity', v_cap));
      v_result := jsonb_build_object('capacity', v_cap);

    WHEN 'resolve_join' THEN
      v_req := (p_payload->>'requestId')::uuid;
      v_approve := coalesce((p_payload->>'approve')::boolean, false);
      IF v_req IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
      SELECT guild_id, member_id INTO v_req_guild, v_req_member
        FROM guild_join_requests
       WHERE id = v_req AND status = 'pending'
         FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
      IF v_req_guild <> p_guild_id THEN RAISE EXCEPTION 'request_not_found'; END IF;
      IF NOT v_approve THEN
        UPDATE guild_join_requests SET status = 'rejected', decided_at = now() WHERE id = v_req;
        INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
        VALUES (
          p_actor_id, 'guild.resolve_join', 'member', v_req_member::text,
          jsonb_build_object('guildId', p_guild_id, 'approve', false, 'requestId', v_req)
        );
        INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
        VALUES (p_guild_id, v_req_member, 'admin_join_rejected', jsonb_build_object('by', p_actor_id));
        v_notify := ARRAY[v_req_member];
        v_result := jsonb_build_object('approved', false);
      ELSE
        IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = v_req_member) THEN
          UPDATE guild_join_requests SET status = 'canceled', decided_at = now() WHERE id = v_req;
          RAISE EXCEPTION 'already_in_guild';
        END IF;
        PERFORM guild_join_precheck(v_req_member, p_guild_id);
        INSERT INTO guild_members (guild_id, member_id, role) VALUES (p_guild_id, v_req_member, 'member');
        UPDATE guild_join_requests SET status = 'approved', decided_at = now() WHERE id = v_req;
        INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
        VALUES (
          p_actor_id, 'guild.resolve_join', 'member', v_req_member::text,
          jsonb_build_object('guildId', p_guild_id, 'approve', true, 'requestId', v_req)
        );
        INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
        VALUES (p_guild_id, v_req_member, 'admin_join_approved', jsonb_build_object('by', p_actor_id));
        v_notify := ARRAY[v_req_member];
        v_result := jsonb_build_object('approved', true);
      END IF;

    WHEN 'add_member' THEN
      v_target := (p_payload->>'targetMemberId')::uuid;
      IF v_target IS NULL THEN RAISE EXCEPTION 'member_not_found'; END IF;
      IF NOT EXISTS (SELECT 1 FROM members WHERE id = v_target AND withdrawn_at IS NULL) THEN
        RAISE EXCEPTION 'member_not_found';
      END IF;
      IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = v_target) THEN
        RAISE EXCEPTION 'already_in_guild';
      END IF;
      PERFORM guild_join_precheck(v_target, p_guild_id);
      INSERT INTO guild_members (guild_id, member_id, role) VALUES (p_guild_id, v_target, 'member');
      UPDATE guild_join_requests
         SET status = 'canceled', decided_at = now()
       WHERE member_id = v_target AND status = 'pending';
      INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
      VALUES (
        p_actor_id, 'guild.add_member', 'member', v_target::text,
        jsonb_build_object('guildId', p_guild_id)
      );
      INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
      VALUES (p_guild_id, v_target, 'admin_added', jsonb_build_object('by', p_actor_id));
      v_notify := ARRAY[v_target];
      v_result := jsonb_build_object('added', v_target);

    ELSE
      RAISE EXCEPTION 'invalid_action';
  END CASE;

  v_result := v_result || jsonb_build_object('notifyMemberIds', to_jsonb(coalesce(v_notify, ARRAY[]::uuid[])));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION admin_guild_act(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_guild_act(uuid, text, uuid, jsonb) TO service_role;
