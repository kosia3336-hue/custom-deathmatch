-- ============================================================
-- 정산 모달 ack · 공지 수정/삭제 · 순위는 점수→레벨→GP (겹치지 않음).
-- 기존 16개 RPC 는 건드리지 않는다. v4 테이블·함수만.
-- 실행: db/guild_v4_rank_settle_1am.sql 이후
-- ============================================================

ALTER TABLE guild_notices ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE IF NOT EXISTS guild_rank_payout_acks (
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  period_kind  text NOT NULL CHECK (period_kind IN ('weekly', 'monthly')),
  period_key   text NOT NULL,
  acked_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, period_kind, period_key)
);
ALTER TABLE guild_rank_payout_acks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_guild_notice_v4(p_actor uuid, p_notice uuid, p_title text, p_body text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_ng uuid;
  v_title text;
  v_body text;
BEGIN
  v_title := btrim(p_title);
  v_body := p_body;
  IF char_length(v_title) < 2 OR char_length(v_title) > 80 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT guild_id INTO v_ng FROM guild_notices WHERE id = p_notice;
  IF v_ng IS NULL OR v_ng <> v_guild THEN RAISE EXCEPTION 'notice_not_found'; END IF;
  UPDATE guild_notices SET title = v_title, body = v_body, updated_at = now() WHERE id = p_notice;
END;
$$;

CREATE OR REPLACE FUNCTION delete_guild_notice_v4(p_actor uuid, p_notice uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_ng uuid;
BEGIN
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT guild_id INTO v_ng FROM guild_notices WHERE id = p_notice;
  IF v_ng IS NULL OR v_ng <> v_guild THEN RAISE EXCEPTION 'notice_not_found'; END IF;
  DELETE FROM guild_notices WHERE id = p_notice;
END;
$$;

CREATE OR REPLACE FUNCTION ack_guild_rank_payout_v4(p_member uuid, p_kind text, p_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
BEGIN
  IF p_kind IS NULL OR p_key IS NULL OR p_kind NOT IN ('weekly', 'monthly') THEN
    RETURN;
  END IF;
  SELECT m.guild_id INTO v_guild FROM guild_v4_active_membership(p_member) m;
  IF v_guild IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM guild_rank_payouts
     WHERE period_kind = p_kind AND period_key = p_key AND guild_id = v_guild
  ) THEN
    RETURN;
  END IF;
  INSERT INTO guild_rank_payout_acks (member_id, period_kind, period_key)
  VALUES (p_member, p_kind, p_key)
  ON CONFLICT (member_id, period_kind, period_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION update_guild_notice_v4(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delete_guild_notice_v4(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ack_guild_rank_payout_v4(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_guild_notice_v4(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION delete_guild_notice_v4(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION ack_guild_rank_payout_v4(uuid, text, text) TO service_role;
