-- ============================================================
-- 길드 랭킹 점수: 인원 바닥 3. 1~3명은 같은 분모.
-- S += M / max(n, 3)^0.65
-- 이미 쌓인 guild_rank_scores 는 다시 나누지 않는다.
-- 기존 16개 RPC 는 건드리지 않는다. v4 함수만 REPLACE.
-- 실행: db/guild_v4_rank_positive.sql 이후
-- ============================================================

CREATE OR REPLACE FUNCTION apply_guild_rank_delta_v4(p_member uuid, p_rp_delta integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_n integer;
  v_add numeric;
  v_w text;
  v_m text;
BEGIN
  IF p_rp_delta IS NULL OR p_rp_delta <= 0 THEN RETURN; END IF;
  SELECT m.guild_id INTO v_guild FROM guild_v4_active_membership(p_member) m;
  IF v_guild IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_n FROM guild_members WHERE guild_id = v_guild;
  v_add := p_rp_delta::numeric / (GREATEST(v_n, 3)::numeric ^ 0.65);
  IF v_add <= 0 THEN RETURN; END IF;
  SELECT weekly, monthly INTO v_w, v_m FROM guild_v4_period_keys();
  INSERT INTO guild_rank_scores (guild_id, period_kind, period_key, score)
  VALUES (v_guild, 'weekly', v_w, v_add)
  ON CONFLICT (guild_id, period_kind, period_key)
  DO UPDATE SET score = GREATEST(0, guild_rank_scores.score + EXCLUDED.score);
  INSERT INTO guild_rank_scores (guild_id, period_kind, period_key, score)
  VALUES (v_guild, 'monthly', v_m, v_add)
  ON CONFLICT (guild_id, period_kind, period_key)
  DO UPDATE SET score = GREATEST(0, guild_rank_scores.score + EXCLUDED.score);
END;
$$;

REVOKE ALL ON FUNCTION apply_guild_rank_delta_v4(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_guild_rank_delta_v4(uuid, integer) TO service_role;
