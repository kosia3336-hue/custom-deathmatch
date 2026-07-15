-- ============================================================
-- 길드 복구 가능성 확보 — 소프트 삭제 + 감사 로그
--   · 해체 시 DELETE 대신 disbanded_at 마킹 (포인트 장부/신청 이력 보존)
--   · guild_audit_log 에 창설/가입/탈퇴/해체/확장/창설권 소모 전부 기록
--   · 길드 이름 unique 는 "활성 길드끼리만" (해체된 이름 재사용 가능)
-- Supabase SQL Editor 에서 실행
-- ============================================================

-- 1) 소프트 삭제 컬럼
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS disbanded_at timestamptz;

-- 2) 이름 unique → 활성 길드 한정 (기존 제약 교체)
ALTER TABLE guilds DROP CONSTRAINT IF EXISTS guilds_name_key;
DROP INDEX IF EXISTS guilds_name_active_uidx;
CREATE UNIQUE INDEX guilds_name_active_uidx ON guilds(name) WHERE disbanded_at IS NULL;

-- 3) 감사 로그
CREATE TABLE IF NOT EXISTS guild_audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id   uuid NOT NULL,                 -- FK 없음: 길드가 지워져도 로그는 남긴다
  member_id  uuid,
  action     text NOT NULL,                 -- created / charter_consumed / join_requested /
                                            -- join_approved / join_rejected / left / disbanded / expanded
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_audit_log_guild_idx ON guild_audit_log(guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS guild_audit_log_member_idx ON guild_audit_log(member_id, created_at DESC);

ALTER TABLE guild_audit_log ENABLE ROW LEVEL SECURITY;
-- 읽기/쓰기 모두 service_role 전용 (정책 없음 = 차단)

-- 4) RPC 개정 — 감사 기록 + 소프트 삭제
CREATE OR REPLACE FUNCTION create_guild(p_member uuid, p_name text, p_description text DEFAULT '')
RETURNS TABLE (guild_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_cnt int;
BEGIN
  IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = p_member) THEN
    RAISE EXCEPTION 'already_in_guild';
  END IF;

  UPDATE shop_consumable_inventory
     SET count = count - 1, updated_at = now()
   WHERE member_id = p_member AND kind = 'guild_charter' AND count > 0;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt = 0 THEN
    RAISE EXCEPTION 'no_charter';
  END IF;

  INSERT INTO guilds (name, description, owner_id)
  VALUES (trim(p_name), COALESCE(p_description, ''), p_member)
  RETURNING id INTO v_guild;

  INSERT INTO guild_members (guild_id, member_id, role) VALUES (v_guild, p_member, 'owner');

  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES
    (v_guild, p_member, 'charter_consumed', '{}'::jsonb),
    (v_guild, p_member, 'created', jsonb_build_object('name', trim(p_name)));

  RETURN QUERY SELECT v_guild;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'name_taken';
END;
$$;

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
    SELECT 1 FROM guild_members WHERE guild_id = v_guild AND member_id = p_owner AND role = 'owner'
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

CREATE OR REPLACE FUNCTION leave_guild(p_member uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_rest int;
BEGIN
  SELECT gm.guild_id, gm.role INTO v_guild, v_role FROM guild_members gm WHERE gm.member_id = p_member;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_in_guild'; END IF;

  SELECT count(*) INTO v_rest FROM guild_members WHERE guild_id = v_guild AND member_id <> p_member;
  IF v_role = 'owner' AND v_rest > 0 THEN
    RAISE EXCEPTION 'owner_must_disband_last';
  END IF;

  DELETE FROM guild_members WHERE member_id = p_member;
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_member, 'left', jsonb_build_object('role', v_role));

  IF v_rest = 0 THEN
    -- 해체: DELETE 대신 소프트 삭제 — 포인트 장부/신청/감사 이력 보존
    UPDATE guilds SET disbanded_at = now() WHERE id = v_guild;
    INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
    VALUES (v_guild, p_member, 'disbanded', '{}'::jsonb);
  END IF;
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
    FROM guild_members gm WHERE gm.member_id = p_owner AND gm.role = 'owner';
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

-- 가입 신청 시점도 기록
CREATE OR REPLACE FUNCTION request_guild_join(p_member uuid, p_guild uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = p_member) THEN
    RAISE EXCEPTION 'already_in_guild';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM guilds WHERE id = p_guild AND disbanded_at IS NULL) THEN
    RAISE EXCEPTION 'guild_not_found';
  END IF;
  PERFORM guild_join_precheck(p_member, p_guild);

  INSERT INTO guild_join_requests (guild_id, member_id) VALUES (p_guild, p_member);
  INSERT INTO guild_audit_log (guild_id, member_id, action)
  VALUES (p_guild, p_member, 'join_requested');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_requested';
END;
$$;

REVOKE ALL ON FUNCTION create_guild(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION decide_guild_join(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION leave_guild(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_guild_expansion(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION request_guild_join(uuid, uuid) FROM PUBLIC, anon, authenticated;
