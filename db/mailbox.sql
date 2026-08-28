-- ============================================================
-- 우편함. 회원×편지 한 줄. 읽음·삭제는 컬럼.
-- 실행: SQL Editor (신규 테이블·신규 RPC. 기존 길드 RPC 안 건드림)
-- ============================================================

CREATE TABLE IF NOT EXISTS mailbox_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source_key  text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('title', 'guild', 'notice', 'reward', 'system')),
  title       text NOT NULL,
  body        text NOT NULL,
  sender      text NOT NULL DEFAULT '시스템',
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz,
  deleted_at  timestamptz,
  UNIQUE (member_id, source_key)
);

CREATE INDEX IF NOT EXISTS mailbox_items_member_list_idx
  ON mailbox_items (member_id, deleted_at, created_at DESC);

CREATE INDEX IF NOT EXISTS mailbox_items_member_unread_idx
  ON mailbox_items (member_id)
  WHERE deleted_at IS NULL AND read_at IS NULL;

ALTER TABLE mailbox_items ENABLE ROW LEVEL SECURITY;

-- 회원별 우편 컷오프. 이 시각 이전 원본(칭호·공지·스카우트·정산)은 넣지 않는다.
CREATE TABLE IF NOT EXISTS mailbox_prefs (
  member_id    uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  notice_since timestamptz NOT NULL
);

ALTER TABLE mailbox_prefs ENABLE ROW LEVEL SECURITY;

-- 이미 있는 회원: 지금 이후만 (옛 칭호·공지 덤프 방지).
-- 이 패치 이후 가입자는 행이 없고, sync가 created_at으로 넣는다.
INSERT INTO mailbox_prefs (member_id, notice_since)
SELECT id, now() FROM members
ON CONFLICT (member_id) DO NOTHING;

-- 클라 직접 SELECT/UPDATE 없음. RPC만.

CREATE OR REPLACE FUNCTION mailbox_notice_category_label(p_cat text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_cat
    WHEN 'general' THEN '일반'
    WHEN 'maintenance' THEN '점검'
    WHEN 'update' THEN '업데이트'
    WHEN 'event' THEN '이벤트'
    WHEN 'urgent' THEN '긴급'
    ELSE p_cat
  END;
$$;

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

  -- 컷오프가 없으면 가입일. 이미 prefs가 있으면 그대로(기존 회원은 패치 때 now()).
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

  -- 그 회원 컷오프 이후 발행분만.
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

  -- 스카우트 초대. 컷오프 이후만. 이미 있으면 그대로.
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

  -- RETURNS TABLE 의 created_at 과 안 겹치게 한정. 미한정이면 42702 로 전부 롤백.
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

CREATE OR REPLACE FUNCTION mark_mailbox_read(p_source_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR p_source_key IS NULL OR btrim(p_source_key) = '' THEN
    RETURN;
  END IF;
  UPDATE mailbox_items
     SET read_at = now()
   WHERE member_id = v_me
     AND source_key = p_source_key
     AND deleted_at IS NULL
     AND read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION mark_mailbox_all_read()
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
  UPDATE mailbox_items
     SET read_at = now()
   WHERE member_id = v_me
     AND deleted_at IS NULL
     AND read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION delete_mailbox_item(p_source_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR p_source_key IS NULL OR btrim(p_source_key) = '' THEN
    RETURN;
  END IF;
  UPDATE mailbox_items
     SET deleted_at = now(),
         read_at = COALESCE(read_at, now())
   WHERE member_id = v_me
     AND source_key = p_source_key
     AND deleted_at IS NULL;
END;
$$;

DROP FUNCTION IF EXISTS mailbox_notice_since();

REVOKE ALL ON FUNCTION mailbox_notice_category_label(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_and_list_mailbox() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mark_mailbox_read(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mark_mailbox_all_read() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delete_mailbox_item(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION sync_and_list_mailbox() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_mailbox_read(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_mailbox_all_read() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_mailbox_item(text) TO authenticated, service_role;

-- 컷오프보다 오래된 편지 정리 (전 kind).
DELETE FROM mailbox_items i
 USING mailbox_prefs p
 WHERE i.member_id = p.member_id
   AND i.created_at < p.notice_since;
