-- ============================================================
-- 우편 기한 + 보상 보호.
--
-- 두 가지 문제를 고친다.
--
--  1) 보상이 달린 편지를 지우면 보상까지 사라졌다.
--     delete_mailbox_item 이 조건 없이 deleted_at 을 찍었고,
--     claim_mailbox_reward 는 deleted_at IS NULL 인 줄만 잡는다.
--     지운 순간 받을 방법이 없어진다. 이제 미수령 보상이 달린 편지는
--     삭제를 거부하고, 왜 거부했는지 알려 준다.
--
--  2) 편지에 기한이 없었다. expires_at 을 두고, 지난 편지는 목록에서
--     내린다. 기한이 지난 보상은 받을 수 없다.
--
-- 만료는 하드 삭제가 아니라 deleted_at 으로 내린다. 칭호·공지·스카우트·
-- 정산 편지는 원본 테이블에서 매번 다시 채워 넣으므로(ON CONFLICT DO
-- NOTHING), 행을 지우면 다음 동기화 때 되살아난다.
--
-- 겸사겸사 sync_and_list_mailbox 의 동기화 본문을 mailbox_sync_for_me()
-- 로 뺐다. 이 200 줄이 db/mailbox.sql · db/mailbox_sync_qualify.sql ·
-- db/mailbox_rewards.sql 에 이미 세 벌 복사돼 있었다. 앞으로 목록에
-- 컬럼을 더할 때 동기화 본문을 다시 베끼지 않아도 된다.
--
-- 실행: Supabase SQL Editor. 여러 번 실행해도 안전하다.
-- 정본 테이블 정의는 db/mailbox.sql 에 있고 이 파일은 그 위에 얹는다.
-- ============================================================

ALTER TABLE mailbox_items ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 기한이 걸린 편지만 훑는다. 대부분의 편지는 expires_at 이 NULL 이다.
CREATE INDEX IF NOT EXISTS mailbox_items_expiring_idx
  ON mailbox_items (expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

-- ── 동기화 본문 ──────────────────────────────────────────────
-- 원본(칭호·공지·스카우트·정산)에서 아직 없는 편지를 채워 넣고,
-- 컷오프보다 오래된 편지와 기한이 지난 편지를 내린다.
-- 목록 조회는 하지 않는다.
CREATE OR REPLACE FUNCTION mailbox_sync_for_me()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM members m WHERE m.id = v_me AND m.withdrawn_at IS NULL
  ) THEN
    RETURN;
  END IF;

  INSERT INTO mailbox_prefs (member_id, notice_since)
  SELECT v_me, m.created_at
    FROM members m
   WHERE m.id = v_me
  ON CONFLICT (member_id) DO NOTHING;

  -- 칭호. 컷오프·가입일 이후 부여만.
  INSERT INTO mailbox_items (
    member_id, source_key, kind, title, body, sender, payload, created_at, read_at
  )
  SELECT
    mt.member_id,
    'title:' || mt.title_id::text,
    'title',
    '칭호 획득!',
    COALESCE(NULLIF(btrim(t.description), ''), t.name),
    '시스템',
    jsonb_build_object(
      'titleGrant', jsonb_build_object(
        'titleId', t.id,
        'name', t.name,
        'color', t.color::text,
        'description', t.description,
        'effect', t.effect
      )
    ),
    mt.granted_at,
    NULL
  FROM member_titles mt
  JOIN titles t ON t.id = mt.title_id
  JOIN mailbox_prefs pref ON pref.member_id = mt.member_id
  JOIN members mem ON mem.id = mt.member_id
  WHERE mt.member_id = v_me
    AND mt.revoked_at IS NULL
    AND mt.granted_at >= pref.notice_since
    AND mt.granted_at >= mem.created_at
  ON CONFLICT (member_id, source_key) DO NOTHING;

  -- 공지. 그 회원 컷오프 이후 발행분만.
  INSERT INTO mailbox_items (
    member_id, source_key, kind, title, body, sender, payload, created_at, read_at
  )
  SELECT
    v_me,
    'notice:' || n.id::text,
    'notice',
    '새 공지 [' || mailbox_notice_category_label(n.category::text) || ']',
    n.title,
    '운영팀',
    '{}'::jsonb,
    n.published_at,
    nr.read_at
  FROM mailbox_prefs p
  JOIN members m ON m.id = p.member_id
  JOIN notices n ON n.is_published = true
    AND n.published_at >= p.notice_since
    AND n.published_at >= m.created_at
  LEFT JOIN notice_reads nr
    ON nr.notice_id = n.id AND nr.member_id = v_me
  WHERE p.member_id = v_me
  ON CONFLICT (member_id, source_key) DO NOTHING;

  -- 스카우트 초대. 컷오프 이후만.
  INSERT INTO mailbox_items (
    member_id, source_key, kind, title, body, sender, payload, created_at, read_at
  )
  SELECT
    s.to_member_id,
    'guild-scout:' || s.id::text,
    'guild',
    '길드 스카우트 초대',
    g.name || ' 길드에서 스카우트 초대가 왔습니다.',
    COALESCE(fm.nickname::text, g.name),
    jsonb_build_object(
      'scoutInvite', jsonb_build_object(
        'inviteId', s.id,
        'guildId', s.guild_id,
        'guildName', g.name,
        'fromNickname', COALESCE(fm.nickname::text, ''),
        'targetHadGuild', s.target_had_guild,
        'targetGuildName', s.target_guild_name
      )
    ),
    s.created_at,
    NULL
  FROM guild_scout_invites_v4 s
  JOIN guilds g ON g.id = s.guild_id
  JOIN mailbox_prefs pref ON pref.member_id = s.to_member_id
  JOIN members mem ON mem.id = s.to_member_id
  LEFT JOIN members fm ON fm.id = s.from_member_id
  WHERE s.to_member_id = v_me
    AND s.created_at >= pref.notice_since
    AND s.created_at >= mem.created_at
  ON CONFLICT (member_id, source_key) DO NOTHING;

  -- 길드 정산 안내. ack 있으면 읽음.
  INSERT INTO mailbox_items (
    member_id, source_key, kind, title, body, sender, payload, created_at, read_at
  )
  SELECT
    v_me,
    'guild-payout:' || p.period_kind || ':' || p.period_key,
    'guild',
    CASE p.period_kind
      WHEN 'weekly' THEN '주간 길드 보상 획득'
      ELSE '월간 길드 보상 획득'
    END,
    concat_ws(
      E'\n',
      CASE WHEN p.gp > 0 THEN '길드 +' || p.gp::text || 'GP 획득.' END,
      CASE WHEN p.tickets > 0 THEN '길드원 전원 뽑기권 ' || p.tickets::text || '개 획득.' END,
      CASE
        WHEN p.period_kind = 'monthly' AND p.rank = 1
        THEN '길드원 전원 칭호 「' || g.name || '」 획득.'
      END
    ),
    '길드',
    '{}'::jsonb,
    p.settled_at,
    a.acked_at
  FROM guild_members gm
  JOIN guild_rank_payouts p ON p.guild_id = gm.guild_id
  JOIN guilds g ON g.id = gm.guild_id
  JOIN mailbox_prefs pref ON pref.member_id = v_me
  JOIN members mem ON mem.id = v_me
  LEFT JOIN guild_rank_payout_acks a
    ON a.member_id = v_me
   AND a.period_kind = p.period_kind
   AND a.period_key = p.period_key
  WHERE gm.member_id = v_me
    AND p.settled_at >= pref.notice_since
    AND p.settled_at >= mem.created_at
    AND (
      p.gp > 0
      OR p.tickets > 0
      OR (p.period_kind = 'monthly' AND p.rank = 1)
    )
    AND concat_ws(
      E'\n',
      CASE WHEN p.gp > 0 THEN '길드 +' || p.gp::text || 'GP 획득.' END,
      CASE WHEN p.tickets > 0 THEN '길드원 전원 뽑기권 ' || p.tickets::text || '개 획득.' END,
      CASE
        WHEN p.period_kind = 'monthly' AND p.rank = 1
        THEN '길드원 전원 칭호 「' || g.name || '」 획득.'
      END
    ) <> ''
  ON CONFLICT (member_id, source_key) DO NOTHING;

  -- 컷오프보다 오래된 편지. 원본에서 다시 안 들어오는 범위라 하드 삭제해도 된다.
  DELETE FROM mailbox_items i
   WHERE i.member_id = v_me
     AND i.created_at < (
       SELECT pref.notice_since FROM mailbox_prefs pref WHERE pref.member_id = v_me
     );

  -- 기한 만료. 하드 삭제하면 위 INSERT 가 다음 호출에 되살리므로 내리기만 한다.
  UPDATE mailbox_items
     SET deleted_at = now()
   WHERE member_id = v_me
     AND deleted_at IS NULL
     AND expires_at IS NOT NULL
     AND expires_at <= now();
END;
$$;

-- ── 목록 조회 ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS sync_and_list_mailbox();

CREATE OR REPLACE FUNCTION sync_and_list_mailbox()
RETURNS TABLE (
  id text,
  kind text,
  title text,
  body text,
  sender text,
  payload jsonb,
  created_at timestamptz,
  read_at timestamptz,
  claimed_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RETURN;
  END IF;

  PERFORM mailbox_sync_for_me();

  RETURN QUERY
  SELECT
    i.source_key,
    i.kind,
    i.title,
    i.body,
    i.sender,
    i.payload,
    i.created_at,
    i.read_at,
    i.claimed_at,
    i.expires_at
  FROM mailbox_items i
  WHERE i.member_id = v_me
    AND i.deleted_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > now())
  ORDER BY i.created_at DESC
  LIMIT 80;
END;
$$;

-- ── 삭제 ─────────────────────────────────────────────────────
-- 미수령 보상이 달렸으면 거부한다. 왜 거부했는지 함께 돌려준다.
DROP FUNCTION IF EXISTS delete_mailbox_item(text);

CREATE OR REPLACE FUNCTION delete_mailbox_item(p_source_key text)
RETURNS TABLE (
  deleted boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_item mailbox_items%ROWTYPE;
BEGIN
  IF v_me IS NULL OR p_source_key IS NULL OR btrim(p_source_key) = '' THEN
    RETURN QUERY SELECT false, 'invalid'::text;
    RETURN;
  END IF;

  SELECT * INTO v_item
    FROM mailbox_items
   WHERE member_id = v_me
     AND source_key = p_source_key
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    -- 이미 지웠거나 없다. 목록에서 사라지는 결과는 같으니 성공으로 본다.
    RETURN QUERY SELECT true, 'gone'::text;
    RETURN;
  END IF;

  IF v_item.claimed_at IS NULL
     AND COALESCE((v_item.payload -> 'reward' ->> 'cdp')::integer, 0) > 0
  THEN
    RETURN QUERY SELECT false, 'unclaimed_reward'::text;
    RETURN;
  END IF;

  UPDATE mailbox_items
     SET deleted_at = now(),
         read_at = COALESCE(read_at, now())
   WHERE member_id = v_me
     AND source_key = p_source_key
     AND deleted_at IS NULL;

  RETURN QUERY SELECT true, 'ok'::text;
END;
$$;

-- ── 수령 ─────────────────────────────────────────────────────
-- 기한이 지난 보상은 받을 수 없다. 나머지는 기존과 같다.
CREATE OR REPLACE FUNCTION claim_mailbox_reward(p_source_key text)
RETURNS TABLE (
  claimed boolean,
  amount integer,
  new_balance integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_item mailbox_items%ROWTYPE;
  v_amount integer;
  v_balance integer;
BEGIN
  IF v_me IS NULL OR p_source_key IS NULL OR btrim(p_source_key) = '' THEN
    RETURN QUERY SELECT false, 0::integer, 0::integer;
    RETURN;
  END IF;

  UPDATE mailbox_items
     SET claimed_at = now(),
         read_at = COALESCE(read_at, now())
   WHERE member_id = v_me
     AND source_key = p_source_key
     AND deleted_at IS NULL
     AND claimed_at IS NULL
     AND kind = 'reward'
     AND (expires_at IS NULL OR expires_at > now())
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    -- 이미 받았거나, 없거나, 기한이 지났거나, 보상 편지가 아니다.
    SELECT COALESCE(balance, 0) INTO v_balance FROM member_cdp WHERE member_id = v_me;
    RETURN QUERY SELECT false, 0::integer, COALESCE(v_balance, 0)::integer;
    RETURN;
  END IF;

  v_amount := COALESCE((v_item.payload -> 'reward' ->> 'cdp')::integer, 0);
  IF v_amount <= 0 THEN
    RETURN QUERY SELECT true, 0::integer, COALESCE(
      (SELECT balance FROM member_cdp WHERE member_id = v_me), 0
    )::integer;
    RETURN;
  END IF;

  INSERT INTO member_cdp (member_id, balance, total_earned)
  VALUES (v_me, v_amount, v_amount)
  ON CONFLICT (member_id) DO UPDATE
    SET balance = member_cdp.balance + EXCLUDED.balance,
        total_earned = member_cdp.total_earned + EXCLUDED.total_earned,
        updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO cdp_ledger (member_id, delta, balance_after, reason, ref_kind, ref_id, metadata)
  VALUES (
    v_me,
    v_amount,
    v_balance,
    'mailbox_reward',
    'mailbox',
    p_source_key,
    jsonb_build_object('title', v_item.title, 'payload', v_item.payload)
  );

  RETURN QUERY SELECT true, v_amount::integer, v_balance::integer;
END;
$$;

REVOKE ALL ON FUNCTION mailbox_sync_for_me() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_and_list_mailbox() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delete_mailbox_item(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION claim_mailbox_reward(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION sync_and_list_mailbox() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_mailbox_item(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION claim_mailbox_reward(text) TO authenticated, service_role;
-- mailbox_sync_for_me 는 sync_and_list_mailbox(SECURITY DEFINER) 안에서만 부른다.
GRANT EXECUTE ON FUNCTION mailbox_sync_for_me() TO service_role;

-- 이미 기한이 지나 있는 편지 정리 (이 패치 시점 기준).
UPDATE mailbox_items
   SET deleted_at = now()
 WHERE deleted_at IS NULL
   AND expires_at IS NOT NULL
   AND expires_at <= now();
