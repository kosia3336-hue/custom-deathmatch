-- 정원 차도 가입 신청 가능. 승인 시 guild_join_precheck 는 기존 decide 그대로.
-- 기존 request_guild_join / guild_join_precheck 는 교체하지 않는다.
-- 실행: SQL Editor (guild_v4.sql 이후)

CREATE OR REPLACE FUNCTION request_guild_join_v4(p_member uuid, p_guild uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM guild_members WHERE member_id = p_member) THEN
    RAISE EXCEPTION 'already_in_guild';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM guilds WHERE id = p_guild AND disbanded_at IS NULL) THEN
    RAISE EXCEPTION 'guild_not_found';
  END IF;

  INSERT INTO guild_join_requests (guild_id, member_id) VALUES (p_guild, p_member);
  INSERT INTO guild_audit_log (guild_id, member_id, action)
  VALUES (p_guild, p_member, 'join_requested');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_requested';
END;
$$;

REVOKE ALL ON FUNCTION request_guild_join_v4(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION request_guild_join_v4(uuid, uuid) TO service_role;
