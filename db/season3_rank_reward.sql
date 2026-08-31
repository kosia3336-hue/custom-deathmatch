-- ============================================================
-- 시즌 3 랭크 종료 보상 — 우편함으로 발송.
--
-- 잔액을 여기서 직접 올리지 않는다. 편지에 금액을 매달아 두고, 받는 사람이
-- 우편함에서 눌러 받을 때 claim_mailbox_reward() 안에서 한 번만 지급된다.
-- 그래야 미수령분이 남아 추적되고, 지급 기록도 cdp_ledger 에 남는다.
--
-- 먼저 db/mailbox_rewards.sql 을 실행해 두어야 한다.
--
-- 티어는 rank_stats.tier 를 기준으로 한다. season_final_tier 는 시즌 3 전원이
-- 아직 null 이라 쓸 수 없다.
--
-- 챌린저는 따로 수동 지급하기로 해서 여기에 넣지 않았다.
--
-- 여러 번 실행해도 안전하다. (member_id, source_key) 가 유니크라 두 번째부터는
-- 그대로 무시된다. 금액을 고쳐 다시 보내려면 source_key 의 'season3-' 뒤를
-- 바꾸거나, 아래 되돌리기로 아직 안 받은 편지를 지우고 다시 넣는다.
-- ============================================================

INSERT INTO mailbox_items (member_id, source_key, kind, title, body, sender, payload)
SELECT
  rs.member_id,
  'gift:season3-' || rs.tier,
  'reward',
  '시즌 3 랭크 보상',
  '시즌 3 랭크 게임 참여 감사합니다. 최종 티어 보상을 보내드립니다.',
  '운영팀',
  jsonb_build_object(
    'reward',
    jsonb_build_object(
      'cdp',
      CASE rs.tier
        WHEN 'diamond' THEN 1000
        WHEN 'gold'    THEN 700
        WHEN 'silver'  THEN 200
        WHEN 'bronze'  THEN 100
      END
    )
  )
FROM rank_stats rs
JOIN members m ON m.id = rs.member_id AND m.withdrawn_at IS NULL
WHERE rs.season_id = 3
  AND rs.tier IN ('diamond', 'gold', 'silver', 'bronze')
ON CONFLICT (member_id, source_key) DO NOTHING;

-- 발송 결과 확인.
SELECT
  split_part(i.source_key, '-', 2) AS tier,
  count(*)                         AS 발송,
  count(i.claimed_at)              AS 수령,
  (i.payload -> 'reward' ->> 'cdp')::int AS cdp
FROM mailbox_items i
WHERE i.source_key LIKE 'gift:season3-%'
GROUP BY tier, cdp
ORDER BY cdp DESC;

-- ── 되돌리기 (필요할 때만) ───────────────────────────────────
-- 아직 받지 않은 편지만 지운다. 이미 받은 사람의 CDP 는 건드리지 않는다.
--
-- DELETE FROM mailbox_items
--  WHERE source_key LIKE 'gift:season3-%'
--    AND claimed_at IS NULL;
