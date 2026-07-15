-- ============================================================
-- 길드 시스템 (Supabase SQL Editor 에서 실행)
--
-- 개요
--  - guilds / guild_members / guild_join_requests / guild_point_ledger
--  - 길드 창설권: 상점 소모품 kind='guild_charter' (1,500 CDP)
--  - 초기 정원 3명, '길드원 추가 모집권'(길드 포인트 500)으로 +1 확장
--  - 티어 할당제: 티어를 상/중/하 3버킷으로 나눠, 같은 버킷 인원이
--    정원의 40% (ceil) 를 넘을 수 없음
--      · 상: diamond, challenger
--      · 중: gold, silver
--      · 하: bronze, unranked
--    (정원 3 → 버킷당 최대 2명 / 정원 5 → 2명 / 정원 6 → 3명)
--  - 길드 포인트: 랭크 게임 종료 시 서버가 grant_guild_points 호출
--      · 승리 +10 GP, 무승부 +5 GP, 패배 +4 GP (길드 단위 적립)
-- ============================================================

-- ── 테이블 ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guilds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 2 AND 20),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  owner_id    uuid NOT NULL REFERENCES members(id),
  capacity    int  NOT NULL DEFAULT 3 CHECK (capacity BETWEEN 3 AND 30),
  points      bigint NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id   uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, member_id)
);
-- 한 회원은 하나의 길드만
CREATE UNIQUE INDEX IF NOT EXISTS guild_members_member_uidx ON guild_members(member_id);

CREATE TABLE IF NOT EXISTS guild_join_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id   uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
-- 같은 길드에 pending 신청은 1건만
CREATE UNIQUE INDEX IF NOT EXISTS guild_join_requests_pending_uidx
  ON guild_join_requests(guild_id, member_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS guild_point_ledger (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guild_id   uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  member_id  uuid REFERENCES members(id),          -- 기여자 (구매/차감은 NULL 가능)
  delta      bigint NOT NULL,
  reason     text NOT NULL,                        -- rank_win / rank_loss / rank_draw / expansion_purchase ...
  ref        text,                                 -- game_log_id 등
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_point_ledger_guild_idx ON guild_point_ledger(guild_id, created_at DESC);

-- RLS: 읽기는 공개, 쓰기는 RPC(service_role/definer)만
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_point_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guilds_read ON guilds;
CREATE POLICY guilds_read ON guilds FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_members_read ON guild_members;
CREATE POLICY guild_members_read ON guild_members FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_join_requests_read ON guild_join_requests;
CREATE POLICY guild_join_requests_read ON guild_join_requests FOR SELECT USING (auth.uid() = member_id);
DROP POLICY IF EXISTS guild_point_ledger_read ON guild_point_ledger;
CREATE POLICY guild_point_ledger_read ON guild_point_ledger FOR SELECT USING (true);

-- ── 티어 버킷 헬퍼 ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION guild_tier_bucket(p_member uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN rs.tier IN ('diamond', 'challenger') THEN 'high'
      WHEN rs.tier IN ('gold', 'silver')        THEN 'mid'
      ELSE 'low'
    END
    FROM rank_stats rs
    JOIN rank_seasons s ON s.id = rs.season_id AND s.is_active
    WHERE rs.member_id = p_member
    LIMIT 1
  ), 'low');  -- 랭크 기록 없으면 '하' 버킷
$$;

-- 버킷당 최대 인원: ceil(capacity * 0.4)
CREATE OR REPLACE FUNCTION guild_bucket_cap(p_capacity int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CEIL(p_capacity * 0.4)::int;
$$;

-- ── 길드 창설 ───────────────────────────────────────────────
-- 창설권(shop_consumable_inventory kind='guild_charter') 1개 소모

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

  RETURN QUERY SELECT v_guild;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'name_taken';
END;
$$;

-- ── 가입 신청 ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION request_guild_join(p_member uuid, p_guild uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = p_member) THEN
    RAISE EXCEPTION 'already_in_guild';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM guilds WHERE id = p_guild) THEN
    RAISE EXCEPTION 'guild_not_found';
  END IF;
  -- 정원/티어 버킷 사전 검증 (승인 시 다시 검증)
  PERFORM guild_join_precheck(p_member, p_guild);

  INSERT INTO guild_join_requests (guild_id, member_id) VALUES (p_guild, p_member);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_requested';
END;
$$;

CREATE OR REPLACE FUNCTION guild_join_precheck(p_member uuid, p_guild uuid)
RETURNS void LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_capacity int;
  v_members int;
  v_bucket text;
  v_bucket_members int;
BEGIN
  SELECT capacity INTO v_capacity FROM guilds WHERE id = p_guild;
  SELECT count(*) INTO v_members FROM guild_members WHERE guild_id = p_guild;
  IF v_members >= v_capacity THEN
    RAISE EXCEPTION 'guild_full';
  END IF;

END;
$$;

CREATE OR REPLACE FUNCTION cancel_guild_join(p_member uuid, p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE guild_join_requests
     SET status = 'canceled', decided_at = now()
   WHERE id = p_request AND member_id = p_member AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
END;
$$;

-- ── 가입 승인/거절 (길드장만) ────────────────────────────────

CREATE OR REPLACE FUNCTION decide_guild_join(p_owner uuid, p_request uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_member uuid;
BEGIN
  SELECT guild_id, member_id INTO v_guild, v_member
    FROM guild_join_requests WHERE id = p_request AND status = 'pending'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM guild_members WHERE guild_id = v_guild AND member_id = p_owner AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT p_approve THEN
    UPDATE guild_join_requests SET status = 'rejected', decided_at = now() WHERE id = p_request;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = v_member) THEN
    UPDATE guild_join_requests SET status = 'canceled', decided_at = now() WHERE id = p_request;
    RAISE EXCEPTION 'already_in_guild';
  END IF;

  PERFORM guild_join_precheck(v_member, v_guild);

  INSERT INTO guild_members (guild_id, member_id, role) VALUES (v_guild, v_member, 'member');
  UPDATE guild_join_requests SET status = 'approved', decided_at = now() WHERE id = p_request;
END;
$$;

-- ── 길드 탈퇴 ───────────────────────────────────────────────
-- 길드장은 다른 멤버가 남아 있으면 탈퇴 불가(해체는 마지막 1인일 때)

CREATE OR REPLACE FUNCTION leave_guild(p_member uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_rest int;
BEGIN
  SELECT guild_id, role INTO v_guild, v_role FROM guild_members WHERE member_id = p_member;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_in_guild'; END IF;

  SELECT count(*) INTO v_rest FROM guild_members WHERE guild_id = v_guild AND member_id <> p_member;
  IF v_role = 'owner' AND v_rest > 0 THEN
    RAISE EXCEPTION 'owner_must_disband_last';
  END IF;

  DELETE FROM guild_members WHERE member_id = p_member;
  IF v_rest = 0 THEN
    DELETE FROM guilds WHERE id = v_guild;
  END IF;
END;
$$;

-- ── 길드 포인트 적립 (서버 service_role 전용) ────────────────

CREATE OR REPLACE FUNCTION grant_guild_points(p_member uuid, p_delta bigint, p_reason text, p_ref text DEFAULT NULL)
RETURNS TABLE (guild_id uuid, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_points bigint;
BEGIN
  SELECT gm.guild_id INTO v_guild FROM guild_members gm WHERE gm.member_id = p_member;
  IF NOT FOUND OR p_delta <= 0 THEN RETURN; END IF;

  UPDATE guilds SET points = points + p_delta WHERE id = v_guild RETURNING points INTO v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason, ref)
  VALUES (v_guild, p_member, p_delta, p_reason, p_ref);

  RETURN QUERY SELECT v_guild, v_points;
END;
$$;

-- ── 길드원 추가 모집권 구매 (길드 포인트 500 → 정원 +1) ──────

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

  RETURN QUERY SELECT v_capacity, v_points;
END;
$$;

-- ── 권한 ────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION create_guild(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION request_guild_join(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cancel_guild_join(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION decide_guild_join(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION leave_guild(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION grant_guild_points(uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_guild_expansion(uuid) FROM PUBLIC, anon, authenticated;

-- ── 상점: 길드 창설권 아이템 등록 (1,500 CDP · 길드 미가입자만 — 서버에서 차단) ──
INSERT INTO shop_items (type, name, description, price, payload, is_active, sort_order)
SELECT 'consumable', '길드 창설권', '새로운 길드를 창설할 수 있는 증서. 길드에 가입하지 않은 회원만 구매할 수 있어요.',
       1500, '{"kind":"guild_charter","no_discount":true}'::jsonb, true, 50
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE payload->>'kind' = 'guild_charter');
