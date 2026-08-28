-- ============================================================
-- 길드 채팅 읽음 워터마크. 같은 회원이면 기기 공통.
-- 기존 16개 RPC · guild_chat.sql 은 건드리지 않는다.
-- ============================================================

CREATE TABLE IF NOT EXISTS guild_chat_seen_v4 (
  member_id        uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  guild_id         uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  last_message_id  uuid NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guild_chat_seen_v4 ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_guild_chat_seen_v4(p_member uuid, p_message uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
BEGIN
  IF p_member IS NULL OR p_message IS NULL THEN RETURN; END IF;
  SELECT gm.guild_id INTO v_guild FROM guild_members gm WHERE gm.member_id = p_member;
  IF v_guild IS NULL THEN RETURN; END IF;
  INSERT INTO guild_chat_seen_v4 (member_id, guild_id, last_message_id, updated_at)
  VALUES (p_member, v_guild, p_message, now())
  ON CONFLICT (member_id) DO UPDATE
    SET last_message_id = EXCLUDED.last_message_id,
        guild_id = EXCLUDED.guild_id,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION set_guild_chat_seen_v4(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_guild_chat_seen_v4(uuid, uuid) TO service_role;
