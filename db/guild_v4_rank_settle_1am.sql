-- ============================================================
-- 길드 랭킹 정산: 기간 경계·지급 시각 = 랭크 종료 01:00 KST.
-- 이번 주(w:2026-08-17) 주간 보상 스킵. 다음 주부터. 8월 월간은 9/1 01:00 지급.
-- 기존 16개 RPC 는 건드리지 않는다. v4 함수만 REPLACE.
-- 실행: db/guild_v4_rank_positive.sql 이후
-- ============================================================

CREATE OR REPLACE FUNCTION guild_v4_period_keys(OUT weekly text, OUT monthly text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_today date;
  v_mon date;
BEGIN
  -- 랭크 평일 종료 01:00 KST. 00:00~00:59 는 전날(전 주/전 달) 세션.
  v_today := ((now() AT TIME ZONE 'Asia/Seoul') - interval '1 hour')::date;
  v_mon := v_today - ((EXTRACT(ISODOW FROM v_today)::int) - 1);
  weekly := 'w:' || to_char(v_mon, 'YYYY-MM-DD');
  monthly := 'm:' || to_char(v_today, 'YYYY-MM');
END;
$$;

CREATE OR REPLACE FUNCTION settle_guild_rank_period_v4(p_kind text, p_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_gp integer;
  v_tickets integer;
  v_title uuid;
  v_name text;
  mem record;
  v_prev uuid;
  v_old_title uuid;
  v_monthly_title_done boolean := false;
BEGIN
  IF p_kind IS NULL OR p_key IS NULL OR p_kind NOT IN ('weekly', 'monthly') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM guild_rank_payouts WHERE period_kind = p_kind AND period_key = p_key) THEN
    RETURN;
  END IF;
  -- 주간 보상은 w:2026-08-24 부터. 이번 주(w:2026-08-17)는 점수는 남기고 GP·뽑기권은 안 줌.
  IF p_kind = 'weekly' AND p_key < 'w:2026-08-24' THEN
    INSERT INTO guild_rank_payouts (period_kind, period_key, guild_id, rank, gp, tickets)
    SELECT p_kind, p_key, s.guild_id, 0, 0, 0
      FROM guild_rank_scores s
     WHERE s.period_kind = p_kind AND s.period_key = p_key
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  FOR r IN
    SELECT g.id, g.name, s.score,
           row_number() OVER (
             ORDER BY s.score DESC,
                      COALESCE(g.buff_cdp_level, 0) DESC,
                      g.points DESC,
                      g.name
           ) AS dr
      FROM guild_rank_scores s
      JOIN guilds g ON g.id = s.guild_id
     WHERE s.period_kind = p_kind AND s.period_key = p_key
       AND g.disbanded_at IS NULL
     ORDER BY s.score DESC,
              COALESCE(g.buff_cdp_level, 0) DESC,
              g.points DESC,
              g.name
  LOOP
    IF r.dr = 1 THEN v_gp := CASE WHEN p_kind = 'weekly' THEN 200 ELSE 500 END; v_tickets := CASE WHEN p_kind = 'weekly' THEN 2 ELSE 3 END;
    ELSIF r.dr = 2 THEN v_gp := CASE WHEN p_kind = 'weekly' THEN 100 ELSE 300 END; v_tickets := 1 + CASE WHEN p_kind = 'monthly' THEN 1 ELSE 0 END;
    ELSIF r.dr = 3 THEN v_gp := CASE WHEN p_kind = 'weekly' THEN 50 ELSE 100 END; v_tickets := 1;
    ELSE v_gp := 0; v_tickets := 0;
    END IF;

    INSERT INTO guild_rank_payouts (period_kind, period_key, guild_id, rank, gp, tickets)
    VALUES (p_kind, p_key, r.id, r.dr, v_gp, v_tickets);

    IF v_gp > 0 THEN
      UPDATE guilds SET points = points + v_gp WHERE id = r.id;
      INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason, ref)
      VALUES (r.id, NULL, v_gp, 'rank_payout', p_kind || ':' || p_key);
    END IF;

    IF v_tickets > 0 THEN
      FOR mem IN SELECT member_id FROM guild_members WHERE guild_id = r.id LOOP
        INSERT INTO shop_consumable_inventory (member_id, kind, count)
        VALUES (mem.member_id, 'gacha_ticket', v_tickets)
        ON CONFLICT (member_id, kind) DO UPDATE
          SET count = shop_consumable_inventory.count + EXCLUDED.count, updated_at = now();
      END LOOP;
    END IF;

    IF p_kind = 'monthly' AND r.dr = 1 AND NOT v_monthly_title_done THEN
      v_monthly_title_done := true;
      SELECT title_id INTO v_old_title FROM guild_monthly_titles WHERE guild_id = r.id;
      v_name := r.name;
      IF v_old_title IS NULL THEN
        INSERT INTO titles (name, color, description, condition_text, is_system, is_legend, effect, is_active)
        VALUES (v_name, 'gold', '지난 달 길드 랭킹 길드원들', '지난 달 길드 랭킹 1위 길드원', false, false, NULL, true)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id INTO v_title;
        IF v_title IS NULL THEN
          SELECT id INTO v_title FROM titles WHERE name = v_name;
        END IF;
        INSERT INTO guild_monthly_titles (guild_id, title_id) VALUES (r.id, v_title)
        ON CONFLICT (guild_id) DO UPDATE SET title_id = EXCLUDED.title_id;
      ELSE
        v_title := v_old_title;
        UPDATE titles SET name = v_name WHERE id = v_title;
      END IF;

      FOR v_prev IN
        SELECT gmt.guild_id FROM guild_monthly_titles gmt WHERE gmt.guild_id <> r.id
      LOOP
        SELECT title_id INTO v_old_title FROM guild_monthly_titles WHERE guild_id = v_prev;
        UPDATE member_titles
           SET revoked_at = now(), revoked_reason = 'guild_monthly_replaced'
         WHERE title_id = v_old_title AND revoked_at IS NULL;
        UPDATE members
           SET displayed_title_id = NULL
         WHERE displayed_title_id = v_old_title;
      END LOOP;

      FOR mem IN SELECT member_id FROM guild_members WHERE guild_id = r.id LOOP
        INSERT INTO member_titles (member_id, title_id, reason)
        VALUES (mem.member_id, v_title, 'guild_monthly_rank')
        ON CONFLICT (member_id, title_id) DO UPDATE
          SET revoked_at = NULL, revoked_reason = NULL, granted_at = now(), reason = 'guild_monthly_rank';
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION guild_v4_period_keys() TO service_role;
GRANT EXECUTE ON FUNCTION settle_guild_rank_period_v4(text, text) TO service_role;
