-- ============================================================
-- 길드 v4 — 더미(/dev/guild) 기능을 운영에 붙이기 위한 새 테이블·새 RPC.
-- 기존 16개 RPC · 기존 guild_* 파일 · 기존 테이블 ALTER 는 하지 않는다.
-- 실행: SQL Editor (기존 guild_*.sql 이후)
-- ============================================================

-- ── 테이블 ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS guild_notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id   uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES members(id),
  title      text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS guild_notices_guild_idx ON guild_notices(guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS guild_notice_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id  uuid NOT NULL REFERENCES guild_notices(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES members(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_notice_comments_notice_idx ON guild_notice_comments(notice_id, created_at);

CREATE TABLE IF NOT EXISTS guild_invest_ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id   uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES members(id),
  cdp        integer NOT NULL CHECK (cdp >= 2),
  gp         integer NOT NULL CHECK (gp >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_invest_ledger_guild_idx ON guild_invest_ledger(guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS guild_grant_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id      uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  from_member   uuid NOT NULL REFERENCES members(id),
  to_member     uuid NOT NULL REFERENCES members(id),
  amount        integer NOT NULL CHECK (amount >= 1),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_grant_ledger_guild_idx ON guild_grant_ledger(guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS guild_menu_layout (
  guild_id   uuid PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  tile_order jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES members(id)
);

CREATE TABLE IF NOT EXISTS guild_rank_scores (
  guild_id     uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  period_kind  text NOT NULL CHECK (period_kind IN ('weekly', 'monthly')),
  period_key   text NOT NULL,
  score        numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, period_kind, period_key)
);

CREATE TABLE IF NOT EXISTS guild_rank_payouts (
  period_kind  text NOT NULL CHECK (period_kind IN ('weekly', 'monthly')),
  period_key   text NOT NULL,
  guild_id     uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  rank         integer NOT NULL,
  gp           integer NOT NULL DEFAULT 0,
  tickets      integer NOT NULL DEFAULT 0,
  settled_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_kind, period_key, guild_id)
);

CREATE TABLE IF NOT EXISTS guild_monthly_titles (
  guild_id  uuid PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  title_id  uuid NOT NULL REFERENCES titles(id)
);

CREATE TABLE IF NOT EXISTS guild_rank_payout_acks (
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  period_kind  text NOT NULL CHECK (period_kind IN ('weekly', 'monthly')),
  period_key   text NOT NULL,
  acked_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, period_kind, period_key)
);

ALTER TABLE guild_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_notice_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_invest_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_grant_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_menu_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_rank_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_rank_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_monthly_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_rank_payout_acks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guild_notices_read ON guild_notices;
CREATE POLICY guild_notices_read ON guild_notices FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_notice_comments_read ON guild_notice_comments;
CREATE POLICY guild_notice_comments_read ON guild_notice_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_invest_ledger_read ON guild_invest_ledger;
CREATE POLICY guild_invest_ledger_read ON guild_invest_ledger FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_grant_ledger_read ON guild_grant_ledger;
CREATE POLICY guild_grant_ledger_read ON guild_grant_ledger FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_menu_layout_read ON guild_menu_layout;
CREATE POLICY guild_menu_layout_read ON guild_menu_layout FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_rank_scores_read ON guild_rank_scores;
CREATE POLICY guild_rank_scores_read ON guild_rank_scores FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_rank_payouts_read ON guild_rank_payouts;
CREATE POLICY guild_rank_payouts_read ON guild_rank_payouts FOR SELECT USING (true);
DROP POLICY IF EXISTS guild_monthly_titles_read ON guild_monthly_titles;
CREATE POLICY guild_monthly_titles_read ON guild_monthly_titles FOR SELECT USING (true);

-- ── 헬퍼 ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION guild_v4_active_membership(p_member uuid)
RETURNS TABLE (guild_id uuid, role text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT gm.guild_id, gm.role::text
    FROM guild_members gm
    JOIN guilds g ON g.id = gm.guild_id
   WHERE gm.member_id = p_member AND g.disbanded_at IS NULL
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION guild_v4_expand_cost(p_capacity integer)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_next integer;
  v_cost integer := 0;
  i integer;
BEGIN
  v_next := GREATEST(1, p_capacity - 3 + 1);
  FOR i IN 1..v_next LOOP
    IF i < 5 THEN v_cost := v_cost + 300; ELSE v_cost := v_cost + 500; END IF;
  END LOOP;
  RETURN v_cost;
END;
$$;

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

-- ── 상점 ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION buy_guild_expansion_v4(p_actor uuid)
RETURNS TABLE (new_capacity integer, cost integer, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_cap integer;
  v_cost integer;
  v_points bigint;
BEGIN
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT capacity, points INTO v_cap, v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_cap >= 30 THEN RAISE EXCEPTION 'capacity_max'; END IF;
  v_cost := guild_v4_expand_cost(v_cap);
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;
  UPDATE guilds SET points = points - v_cost, capacity = capacity + 1
   WHERE id = v_guild RETURNING capacity, points INTO v_cap, v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_actor, -v_cost, 'expansion_purchase');
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_actor, 'expand_v4', jsonb_build_object('capacity', v_cap, 'cost', v_cost));
  RETURN QUERY SELECT v_cap, v_cost, v_points;
END;
$$;

CREATE OR REPLACE FUNCTION buy_guild_buff_v4(p_actor uuid)
RETURNS TABLE (new_level integer, cost bigint, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_level integer;
  v_cost bigint;
  v_points bigint;
BEGIN
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT buff_cdp_level, points INTO v_level, v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_level >= 9 THEN RAISE EXCEPTION 'buff_max_level'; END IF;
  v_cost := 100 * (2 ^ v_level)::bigint;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;
  UPDATE guilds
     SET points = points - v_cost, buff_cdp_level = buff_cdp_level + 1
   WHERE id = v_guild
   RETURNING buff_cdp_level, points INTO v_level, v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_actor, -v_cost, 'buff_cdp_purchase');
  RETURN QUERY SELECT v_level, v_cost, v_points;
END;
$$;

CREATE OR REPLACE FUNCTION update_guild_name_v4(p_actor uuid, p_name text)
RETURNS TABLE (new_name text, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_cost bigint := 300;
  v_points bigint;
  v_name text;
  v_cur text;
BEGIN
  v_name := btrim(p_name);
  IF v_name IS NULL OR char_length(v_name) < 2 OR char_length(v_name) > 10
     OR v_name !~ '^[A-Za-z가-힣]+$' THEN
    RAISE EXCEPTION 'invalid_name_chars';
  END IF;
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT name, points INTO v_cur, v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_cur = v_name THEN RAISE EXCEPTION 'same_name'; END IF;
  IF EXISTS (SELECT 1 FROM guilds WHERE name = v_name AND disbanded_at IS NULL AND id <> v_guild) THEN
    RAISE EXCEPTION 'name_taken';
  END IF;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;
  UPDATE guilds SET points = points - v_cost, name = v_name
   WHERE id = v_guild RETURNING name, points INTO v_name, v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_actor, -v_cost, 'name_change_purchase');
  RETURN QUERY SELECT v_name, v_points;
END;
$$;

CREATE OR REPLACE FUNCTION set_guild_catalog_mark_v4(p_actor uuid, p_logo_id text)
RETURNS TABLE (mark_url text, new_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_cost bigint := 300;
  v_points bigint;
  v_url text;
  v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM unnest(ARRAY[
      'crown','shield','sword','dual-swords','axe','spear','bow','star','moon','sun',
      'lightning','flame','wave','rose','skull','dragon','wolf','tiger','eagle','lion',
      'bear','stag','fox','owl','snake','rabbit','phoenix','griffin','raven','panther',
      'hydra','falcon','scorpion','ram','horse','boar','kraken','hammer','trident','helm',
      'castle','gem','eye','mask','comet','crystal','ship','dagger'
    ]) AS x(id) WHERE x.id = p_logo_id
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'invalid_logo'; END IF;
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT points INTO v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_points < v_cost THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;
  v_url := '/guild/logos/' || p_logo_id || '.png';
  UPDATE guilds SET points = points - v_cost, mark_url = v_url
   WHERE id = v_guild RETURNING guilds.mark_url, points INTO v_url, v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_actor, -v_cost, 'mark_purchase');
  RETURN QUERY SELECT v_url, v_points;
END;
$$;

CREATE OR REPLACE FUNCTION set_guild_vice_v4(p_actor uuid, p_target uuid, p_promote boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_vices integer;
BEGIN
  SELECT m.guild_id INTO v_guild FROM guild_v4_active_membership(p_actor) m WHERE m.role = 'owner';
  IF v_guild IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_target = p_actor THEN RAISE EXCEPTION 'cannot_target_self'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM guild_members WHERE guild_id = v_guild AND member_id = p_target
  ) THEN RAISE EXCEPTION 'member_not_found'; END IF;
  IF p_promote THEN
    SELECT count(*) INTO v_vices FROM guild_members
     WHERE guild_id = v_guild AND role = 'vice_owner' AND member_id <> p_target;
    IF v_vices >= 2 THEN RAISE EXCEPTION 'vice_full'; END IF;
    UPDATE guild_members SET role = 'vice_owner'
     WHERE guild_id = v_guild AND member_id = p_target AND role <> 'owner';
  ELSE
    UPDATE guild_members SET role = 'member'
     WHERE guild_id = v_guild AND member_id = p_target AND role = 'vice_owner';
  END IF;
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_actor, 'set_vice_v4', jsonb_build_object('target', p_target, 'promote', p_promote));
END;
$$;

CREATE OR REPLACE FUNCTION disband_guild_v4(p_actor uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
BEGIN
  SELECT m.guild_id INTO v_guild FROM guild_v4_active_membership(p_actor) m WHERE m.role = 'owner';
  IF v_guild IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM guild_members WHERE guild_id = v_guild;
  UPDATE guilds SET disbanded_at = now() WHERE id = v_guild AND disbanded_at IS NULL;
  INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
  VALUES (v_guild, p_actor, 'disband_v4', '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION update_guild_description_v4(p_actor uuid, p_description text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_desc text;
BEGIN
  v_desc := left(btrim(COALESCE(p_description, '')), 50);
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE guilds SET description = v_desc WHERE id = v_guild;
END;
$$;

CREATE OR REPLACE FUNCTION set_guild_tile_order_v4(p_actor uuid, p_order jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
BEGIN
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO guild_menu_layout (guild_id, tile_order, updated_at, updated_by)
  VALUES (v_guild, p_order, now(), p_actor)
  ON CONFLICT (guild_id) DO UPDATE
    SET tile_order = EXCLUDED.tile_order, updated_at = now(), updated_by = EXCLUDED.updated_by;
END;
$$;

-- ── 투자 / 지급 ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION invest_guild_cdp_v4(p_member uuid, p_cdp integer)
RETURNS TABLE (gp integer, new_guild_points bigint, new_cdp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_gp integer;
  v_bal integer;
  v_gpoints bigint;
BEGIN
  IF p_cdp IS NULL OR p_cdp < 2 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  v_gp := floor((p_cdp::numeric * 2) / 3)::integer;
  IF v_gp < 1 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT m.guild_id INTO v_guild FROM guild_v4_active_membership(p_member) m;
  IF v_guild IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO member_cdp (member_id, balance) VALUES (p_member, 0)
  ON CONFLICT (member_id) DO NOTHING;
  SELECT balance INTO v_bal FROM member_cdp WHERE member_id = p_member FOR UPDATE;
  IF v_bal < p_cdp THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE member_cdp
     SET balance = balance - p_cdp, total_spent = total_spent + p_cdp, updated_at = now()
   WHERE member_id = p_member
   RETURNING balance INTO v_bal;
  INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
  VALUES (p_member, -p_cdp, v_bal, 'guild_invest', 'guild', v_guild::text,
          jsonb_build_object('gp', v_gp));

  SELECT points INTO v_gpoints FROM guilds WHERE id = v_guild FOR UPDATE;
  UPDATE guilds SET points = points + v_gp WHERE id = v_guild RETURNING points INTO v_gpoints;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
  VALUES (v_guild, p_member, v_gp, 'invest');
  INSERT INTO guild_invest_ledger (guild_id, member_id, cdp, gp)
  VALUES (v_guild, p_member, p_cdp, v_gp);

  RETURN QUERY SELECT v_gp, v_gpoints, v_bal;
END;
$$;

CREATE OR REPLACE FUNCTION grant_guild_cdp_v4(p_actor uuid, p_target uuid, p_amount integer)
RETURNS TABLE (new_guild_points bigint, new_cdp integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_points bigint;
  v_bal integer;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM guild_members WHERE guild_id = v_guild AND member_id = p_target
  ) THEN RAISE EXCEPTION 'member_not_found'; END IF;

  SELECT points INTO v_points FROM guilds WHERE id = v_guild FOR UPDATE;
  IF v_points < p_amount THEN RAISE EXCEPTION 'insufficient_guild_points'; END IF;
  UPDATE guilds SET points = points - p_amount WHERE id = v_guild RETURNING points INTO v_points;
  INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason, ref)
  VALUES (v_guild, p_actor, -p_amount, 'grant_cdp', p_target::text);

  INSERT INTO member_cdp (member_id, balance) VALUES (p_target, 0)
  ON CONFLICT (member_id) DO NOTHING;
  UPDATE member_cdp
     SET balance = balance + p_amount, total_earned = total_earned + p_amount, updated_at = now()
   WHERE member_id = p_target
   RETURNING balance INTO v_bal;
  INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
  VALUES (p_target, p_amount, v_bal, 'guild_grant', 'guild', v_guild::text,
          jsonb_build_object('from', p_actor));
  INSERT INTO guild_grant_ledger (guild_id, from_member, to_member, amount)
  VALUES (v_guild, p_actor, p_target, p_amount);

  RETURN QUERY SELECT v_points, v_bal;
END;
$$;

-- ── 공지 ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION post_guild_notice_v4(p_actor uuid, p_title text, p_body text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_role text;
  v_id uuid;
  v_title text;
  v_body text;
BEGIN
  v_title := btrim(p_title);
  v_body := p_body;
  IF char_length(v_title) < 2 OR char_length(v_title) > 80 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 10000 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  SELECT m.guild_id, m.role INTO v_guild, v_role FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL OR v_role NOT IN ('owner', 'vice_owner') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO guild_notices (guild_id, author_id, title, body)
  VALUES (v_guild, p_actor, v_title, v_body)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION comment_guild_notice_v4(p_actor uuid, p_notice uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_guild uuid;
  v_ng uuid;
  v_id uuid;
  v_body text;
BEGIN
  v_body := btrim(p_body);
  IF char_length(v_body) < 1 OR char_length(v_body) > 100 THEN RAISE EXCEPTION 'invalid_body'; END IF;
  SELECT m.guild_id INTO v_guild FROM guild_v4_active_membership(p_actor) m;
  IF v_guild IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT guild_id INTO v_ng FROM guild_notices WHERE id = p_notice;
  IF v_ng IS NULL OR v_ng <> v_guild THEN RAISE EXCEPTION 'notice_not_found'; END IF;
  INSERT INTO guild_notice_comments (notice_id, author_id, body)
  VALUES (p_notice, p_actor, v_body)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

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
-- 점수 재료는 양수만. 패배 RP는 호출부가 20%로 바꿔서 넣는다.

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
  v_add := p_rp_delta::numeric / (GREATEST(v_n, 1)::numeric ^ 0.65);
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

-- 현재 주/월을 제외하고, 점수 행이 있는데 아직 안 준 기간을 전부 정산.
-- 호출 시각은 서버가 01:00 KST 로 제한한다. 기간 키도 01:00 에 넘어간다.
CREATE OR REPLACE FUNCTION settle_due_guild_ranks_v4()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_w text;
  v_m text;
  r record;
  v_n integer := 0;
BEGIN
  SELECT weekly, monthly INTO v_w, v_m FROM guild_v4_period_keys();
  FOR r IN
    SELECT DISTINCT s.period_kind, s.period_key
      FROM guild_rank_scores s
     WHERE NOT (s.period_kind = 'weekly' AND s.period_key = v_w)
       AND NOT (s.period_kind = 'monthly' AND s.period_key = v_m)
       AND NOT EXISTS (
         SELECT 1 FROM guild_rank_payouts p
          WHERE p.period_kind = s.period_kind AND p.period_key = s.period_key
       )
  LOOP
    PERFORM settle_guild_rank_period_v4(r.period_kind, r.period_key);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION guild_v4_active_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guild_v4_expand_cost(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION guild_v4_period_keys() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_guild_buff_v4(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION buy_guild_expansion_v4(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_guild_name_v4(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_guild_catalog_mark_v4(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_guild_vice_v4(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION disband_guild_v4(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_guild_description_v4(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_guild_tile_order_v4(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION invest_guild_cdp_v4(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION grant_guild_cdp_v4(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION post_guild_notice_v4(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION comment_guild_notice_v4(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_guild_notice_v4(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delete_guild_notice_v4(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ack_guild_rank_payout_v4(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION apply_guild_rank_delta_v4(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION settle_guild_rank_period_v4(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION settle_due_guild_ranks_v4() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION buy_guild_buff_v4(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION buy_guild_expansion_v4(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION update_guild_name_v4(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION set_guild_catalog_mark_v4(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION set_guild_vice_v4(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION disband_guild_v4(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION update_guild_description_v4(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION set_guild_tile_order_v4(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION invest_guild_cdp_v4(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION grant_guild_cdp_v4(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION post_guild_notice_v4(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION comment_guild_notice_v4(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION update_guild_notice_v4(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION delete_guild_notice_v4(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION ack_guild_rank_payout_v4(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION apply_guild_rank_delta_v4(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION settle_guild_rank_period_v4(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION settle_due_guild_ranks_v4() TO service_role;
GRANT EXECUTE ON FUNCTION guild_v4_period_keys() TO service_role;
GRANT EXECUTE ON FUNCTION guild_v4_expand_cost(integer) TO service_role;
GRANT EXECUTE ON FUNCTION guild_v4_active_membership(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION transfer_guild_owner(uuid, uuid) TO service_role;
