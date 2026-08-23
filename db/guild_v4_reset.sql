-- ============================================================
-- 길드 v4 운영 데이터 초기화 (1회).
-- 길드는 해체하지 않는다. 길드장만 남기고 강퇴. 버프·정원·GP 리셋 후 보상 GP.
--   엔드 500 / 타짜 250 / 스트론튬(운영) 0
-- 이름은 유지. 커스텀 로고(guild-marks)는 지운다. 상점 카탈로그만 쓴다.
-- 실행: db/guild_v4.sql 이후
-- ============================================================

UPDATE guild_join_requests
   SET status = 'canceled', decided_at = now()
 WHERE status = 'pending';

DELETE FROM guild_members gm
 USING guilds g
 WHERE gm.guild_id = g.id
   AND g.disbanded_at IS NULL
   AND gm.role <> 'owner';

UPDATE guilds
   SET buff_cdp_level = 0,
       capacity = 3,
       points = 0,
       mark_url = NULL
 WHERE disbanded_at IS NULL;

UPDATE guilds SET points = 500 WHERE name = '엔드' AND disbanded_at IS NULL;
UPDATE guilds SET points = 250 WHERE name = '타짜' AND disbanded_at IS NULL;
UPDATE guilds SET points = 0 WHERE name = '스트론튬' AND disbanded_at IS NULL;

INSERT INTO guild_point_ledger (guild_id, member_id, delta, reason)
SELECT id, owner_id, points, 'v4_reset_grant'
  FROM guilds
 WHERE disbanded_at IS NULL AND points > 0;

INSERT INTO guild_audit_log (guild_id, member_id, action, detail)
SELECT id, owner_id, 'v4_reset', jsonb_build_object('points', points)
  FROM guilds
 WHERE disbanded_at IS NULL;
