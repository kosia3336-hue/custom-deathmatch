-- ============================================================
-- 길드 v3 — 부길드장 역할 + 길드 설명 수정 + 권한 위임
--   · role: 'owner' | 'vice_owner' | 'member' (기존 owner/member 에 vice_owner 추가)
--   · 부길드장은 해체(=owner 전용 leave 제약)만 빼고 길드장과 동일한 권한:
--       가입 승인/거절, 추방, 정원 확장, 마크 등록, CDP 버프 구매, 설명 수정
--   · 부길드장 임명/해제는 길드장만 가능 (set_guild_vice)
-- 실행: Supabase SQL Editor (db/guilds.sql, db/guild_audit.sql, db/guild_mark_buff.sql,
--       db/guild_kick.sql 이후)
-- ============================================================

-- 1) role 제약 확장 (기존 체크 제약을 이름 무관하게 찾아 교체)
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
   WHERE conrelid = 'guild_members'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%role%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE guild_members DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE guild_members
  ADD CONSTRAINT guild_members_role_check CHECK (role IN ('owner', 'vice_owner', 'member'));

-- 2) 부길드장 임명/해제 (길드장 전용)
CREATE OR REPLACE FUNCTION set_guild_vice(p_owner uuid, p_target uuid, p_promote boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_target_role text;
BEGIN
  SELECT guild_id INTO v_guild FROM guild_members WHERE member_id = p_owner AND role = 'owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_target = p_owner THEN RAISE EXCEPTION 'cannot_target_self'; END IF;

  SELECT role INTO v_target_role FROM guild_members WHERE guild_id = v_guild AND member_id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;

  UPDATE guild_members
     SET role = CASE WHEN p_promote THEN 'vice_owner' ELSE 'member' END
   WHERE guild_id = v_guild AND member_id = p_target;

  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_target, CASE WHEN p_promote THEN 'promoted_vice' ELSE 'demoted_vice' END,
          jsonb_build_object('by', p_owner));
END;
$$;

-- 3) 길드 설명 수정 (길드장·부길드장)
CREATE OR REPLACE FUNCTION update_guild_description(p_actor uuid, p_description text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
BEGIN
  SELECT guild_id INTO v_guild FROM guild_members
   WHERE member_id = p_actor AND role IN ('owner', 'vice_owner');
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_description IS NULL OR char_length(p_description) > 200 THEN
    RAISE EXCEPTION 'description_too_long';
  END IF;

  UPDATE guilds SET description = trim(p_description) WHERE id = v_guild;
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_actor, 'description_updated', '{}'::jsonb);
END;
$$;

-- 4) 기존 RPC 권한 위임: owner 전용 → owner + vice_owner
--    (db/guild_audit.sql 의 최신 버전을 기준으로 감사 로그 유지하며 재정의)
--    ⚠ 파라미터 이름은 그대로 p_owner 유지 — Postgres 는 CREATE OR REPLACE 로
--    기존 함수의 파라미터 '이름'을 바꿀 수 없다(타입이 같아도 42P13 에러).
--    호출부(app/api/guild/action/route.ts, app/api/guild/mark/route.ts)도
--    여전히 p_owner 로 호출하므로 이름을 바꾸면 안 맞는다.

CREATE OR REPLACE FUNCTION decide_guild_join(p_owner uuid, p_request uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_member uuid;
BEGIN
  SELECT gjr.guild_id, gjr.member_id INTO v_guild, v_member
    FROM guild_join_requests gjr WHERE gjr.id = p_request AND gjr.status = 'pending'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM guild_members
     WHERE guild_id = v_guild AND member_id = p_owner AND role IN ('owner', 'vice_owner')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT p_approve THEN
    UPDATE guild_join_requests SET status = 'rejected', decided_at = now() WHERE id = p_request;
    INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
    VALUES (v_guild, v_member, 'join_rejected', jsonb_build_object('by', p_owner));
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = v_member) THEN
    UPDATE guild_join_requests SET status = 'canceled', decided_at = now() WHERE id = p_request;
    RAISE EXCEPTION 'already_in_guild';
  END IF;

  PERFORM guild_join_precheck(v_member, v_guild);

  INSERT INTO guild_members (guild_id, member_id, role) VALUES (v_guild, v_member, 'member');
  UPDATE guild_join_requests SET status = 'approved', decided_at = now() WHERE id = p_request;

  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, v_member, 'join_approved', jsonb_build_object('by', p_owner));
END;
$$;

CREATE OR REPLACE FUNCTION buy_guild_expansion(p_owner uuid)
RETURNS TABLE (new_capacity int, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_cost bigint := 500;
  v_capacity int;
  v_points bigint;
BEGIN
  SELECT gm.guild_id INTO v_guild
    FROM guild_members gm WHERE gm.member_id = p_owner AND gm.role IN ('owner', 'vice_owner');
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT capacity, points INTO v_capacity, v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_capacity >= 30 THEN RAISE EXCEPTION 'capacity_max'; END IF;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;

  UPDATE guilds SET points = points - v_cost, capacity = capacity + 1
   WHERE id = v_guild RETURNING capacity, points INTO v_capacity, v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_owner, -v_cost, 'expansion_purchase');
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_owner, 'expanded', jsonb_build_object('new_capacity', v_capacity, 'cost', v_cost));

  RETURN QUERY SELECT v_capacity, v_points;
END;
$$;

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
    FROM guild_members gm WHERE gm.member_id = p_owner AND gm.role IN ('owner', 'vice_owner');
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
    FROM guild_members gm WHERE gm.member_id = p_owner AND gm.role IN ('owner', 'vice_owner');
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
REVOKE ALL ON FUNCTION set_guild_vice(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_guild_description(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION decide_guild_join(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_guild_expansion(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_guild_mark(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_guild_buff(uuid) FROM PUBLIC, anon, authenticated;
