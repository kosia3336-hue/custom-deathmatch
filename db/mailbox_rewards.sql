-- ============================================================
-- 우편함 보상 수령. 편지에 CDP 를 매달고, 눌러서 받는다.
--
-- 지금까지 우편함은 알림만 했다. kind 에 'reward' 자리는 있었지만 금액도
-- 수령 상태도 담을 곳이 없어 실제로 쓰이지 않았다. 여기서 세 가지를 더한다.
--   1) mailbox_items.claimed_at — 언제 받았는지
--   2) sync_and_list_mailbox 가 claimed_at 을 함께 돌려주도록 확장
--   3) claim_mailbox_reward() — 잔액 증가 + cdp_ledger 기록 + 수령 도장
--
-- 보상은 payload 에 이렇게 넣는다.
--   {"reward": {"cdp": 1000}}
--
-- 실행: Supabase SQL Editor. 여러 번 실행해도 안전하다.
-- 정본 테이블 정의는 db/mailbox.sql 에 있고 이 파일은 그 위에 얹는다.
-- ============================================================

ALTER TABLE mailbox_items ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- 미수령 보상 편지를 빨리 찾기 위한 인덱스.
CREATE INDEX IF NOT EXISTS mailbox_items_unclaimed_reward_idx
  ON mailbox_items (member_id)
  WHERE deleted_at IS NULL AND claimed_at IS NULL AND kind = 'reward';

-- ── 목록 조회에 claimed_at 추가 ───────────────────────────────
-- 본문은 db/mailbox_sync_qualify.sql 과 같고 RETURNS TABLE 과 마지막
-- SELECT 에만 claimed_at 을 더했다. 동기화는 원본에서 없는 편지를 채워
-- 넣기만 하므로, 여기서 직접 넣은 보상 편지는 지워지지 않는다.
-- (지우는 것은 컷오프보다 오래된 편지뿐이다.)
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
  claimed_at timestamptz
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

  DELETE FROM mailbox_items i
   WHERE i.member_id = v_me
     AND i.created_at < (
       SELECT pref.notice_since FROM mailbox_prefs pref WHERE pref.member_id = v_me
     );

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
    i.claimed_at
  FROM mailbox_items i
  WHERE i.member_id = v_me
    AND i.deleted_at IS NULL
  ORDER BY i.created_at DESC
  LIMIT 80;
END;
$$;

-- ── 보상 수령 ────────────────────────────────────────────────
-- 멱등하다. 이미 받은 편지를 다시 눌러도 잔액이 두 번 오르지 않는다.
-- claimed_at 을 조건부로 먼저 찍고, 그 UPDATE 가 실제로 한 줄을 잡았을
-- 때만 지급한다. 동시에 두 번 눌러도 한 번만 통과한다.
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
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    -- 이미 받았거나, 없거나, 보상 편지가 아니다. 현재 잔액만 알려 준다.
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

REVOKE ALL ON FUNCTION claim_mailbox_reward(text) FROM public;
GRANT EXECUTE ON FUNCTION claim_mailbox_reward(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_and_list_mailbox() TO authenticated;
