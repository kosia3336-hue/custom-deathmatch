-- ============================================================
-- sync_and_list_mailbox: 컷오프 DELETE 의 created_at 한정.
-- RETURNS TABLE(created_at) 과 겹치면 42702, INSERT가 전부 롤백됨.
-- 정본은 db/mailbox.sql. 이 파일은 함수만 REPLACE.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_and_list_mailbox()
RETURNS TABLE (
  id text,
  kind text,
  title text,
  body text,
  sender text,
  payload jsonb,
  created_at timestamptz,
  read_at timestamptz
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
    i.read_at
  FROM mailbox_items i
  WHERE i.member_id = v_me
    AND i.deleted_at IS NULL
  ORDER BY i.created_at DESC
  LIMIT 80;
END;
$$;

REVOKE ALL ON FUNCTION sync_and_list_mailbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sync_and_list_mailbox() TO authenticated, service_role;
