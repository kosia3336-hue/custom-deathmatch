-- ─────────────────────────────────────────────────────────────
-- 길드 채팅 — 길드원 전용, 오래된 메시지 자동 정리
--   · 보관 기간 14일 — 메시지 전송 시마다 해당 길드의 14일 지난 메시지를 정리한다
--     (pg_cron 없이도 동작하는 opportunistic cleanup)
--   · 실시간 전달은 소켓 서버가 담당(REST 아님) — service_role 로 이 RPC 를 호출한다.
-- 실행: Supabase SQL Editor (db/guilds.sql 이후)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guild_chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id   uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  message    text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_chat_messages_guild_idx
  ON guild_chat_messages(guild_id, created_at DESC);

ALTER TABLE guild_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guild_chat_messages_read ON guild_chat_messages;
CREATE POLICY guild_chat_messages_read ON guild_chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM guild_members gm
     WHERE gm.guild_id = guild_chat_messages.guild_id AND gm.member_id = auth.uid()
  ));
-- 쓰기는 service_role(소켓 서버)의 RPC 를 통해서만.

-- 전송 — 길드원 검증 + 저장 + 14일 지난 메시지 정리
CREATE OR REPLACE FUNCTION send_guild_chat(p_member uuid, p_message text)
RETURNS TABLE (id uuid, guild_id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_id uuid;
  v_created timestamptz;
BEGIN
  SELECT gm.guild_id INTO v_guild FROM guild_members gm WHERE gm.member_id = p_member;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_in_guild'; END IF;

  IF p_message IS NULL OR char_length(trim(p_message)) = 0 OR char_length(p_message) > 200 THEN
    RAISE EXCEPTION 'invalid_message';
  END IF;

  INSERT INTO guild_chat_messages (guild_id, member_id, message)
  VALUES (v_guild, p_member, trim(p_message))
  RETURNING guild_chat_messages.id, guild_chat_messages.created_at INTO v_id, v_created;

  DELETE FROM guild_chat_messages gcm
   WHERE gcm.guild_id = v_guild AND gcm.created_at < now() - interval '14 days';

  RETURN QUERY SELECT v_id, v_guild, v_created;
END;
$$;

-- 최근 메시지 조회 (길드원만) — 소켓 접속/길드 채팅 탭 진입 시 히스토리 로드
CREATE OR REPLACE FUNCTION get_guild_chat_history(p_member uuid, p_limit int DEFAULT 50)
RETURNS TABLE (id uuid, member_id uuid, message text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_guild uuid;
BEGIN
  SELECT gm.guild_id INTO v_guild FROM guild_members gm WHERE gm.member_id = p_member;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_in_guild'; END IF;

  RETURN QUERY
    SELECT m.id, m.member_id, m.message, m.created_at
      FROM guild_chat_messages m
     WHERE m.guild_id = v_guild
     ORDER BY m.created_at DESC
     LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION send_guild_chat(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_guild_chat_history(uuid, int) FROM PUBLIC, anon, authenticated;
