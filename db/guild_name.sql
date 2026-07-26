-- ─────────────────────────────────────────────────────────────
-- 길드명 문자 제한 + 길드명 변경권(300 GP)
--   · 허용 문자: 영어(대소문자) + 완성형 한글 음절만.
--     공백·숫자·특수문자·이모지·낱자모(ㄹ,ㅎ,ㅣ 등)는 전부 불허.
--     ('가-힣' 범위는 완성형 음절만 포함해 낱자모를 자연히 배제한다.)
--   · create_guild 도 같은 규칙으로 재검증(기존엔 길이만 검사했음).
--   · update_guild_name: 길드장·부길드장 전용, 300 GP 차감.
-- 실행: Supabase SQL Editor (db/guilds.sql, db/guild_audit.sql, db/guild_v3.sql 이후)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_guild(p_member uuid, p_name text, p_description text DEFAULT '')
RETURNS TABLE (guild_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_cnt int;
  v_name text := trim(p_name);
BEGIN
  IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = p_member) THEN
    RAISE EXCEPTION 'already_in_guild';
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 20 OR v_name !~ '^[A-Za-z가-힣]+$' THEN
    RAISE EXCEPTION 'invalid_name_chars';
  END IF;

  UPDATE shop_consumable_inventory
     SET count = count - 1, updated_at = now()
   WHERE member_id = p_member AND kind = 'guild_charter' AND count > 0;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt = 0 THEN
    RAISE EXCEPTION 'no_charter';
  END IF;

  INSERT INTO guilds (name, description, owner_id)
  VALUES (v_name, COALESCE(p_description, ''), p_member)
  RETURNING id INTO v_guild;

  INSERT INTO guild_members (guild_id, member_id, role) VALUES (v_guild, p_member, 'owner');

  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES
    (v_guild, p_member, 'charter_consumed', '{}'::jsonb),
    (v_guild, p_member, 'created', jsonb_build_object('name', v_name));

  RETURN QUERY SELECT v_guild;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'name_taken';
END;
$$;

-- 길드명 변경 (길드장·부길드장, 300 GP)
CREATE OR REPLACE FUNCTION update_guild_name(p_actor uuid, p_name text)
RETURNS TABLE (name text, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_cost bigint := 300;
  v_points bigint;
  v_name text := trim(p_name);
BEGIN
  IF char_length(v_name) < 2 OR char_length(v_name) > 20 OR v_name !~ '^[A-Za-z가-힣]+$' THEN
    RAISE EXCEPTION 'invalid_name_chars';
  END IF;

  SELECT guild_id INTO v_guild FROM guild_members
   WHERE member_id = p_actor AND role IN ('owner', 'vice_owner');
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT points INTO v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;

  UPDATE guilds SET points = points - v_cost, name = v_name
   WHERE id = v_guild RETURNING guilds.name, points INTO v_name, v_points;

  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_actor, -v_cost, 'name_change_purchase');
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_actor, 'name_changed', jsonb_build_object('new_name', v_name));

  RETURN QUERY SELECT v_name, v_points;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'name_taken';
END;
$$;

REVOKE ALL ON FUNCTION create_guild(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_guild_name(uuid, text) FROM PUBLIC, anon, authenticated;
