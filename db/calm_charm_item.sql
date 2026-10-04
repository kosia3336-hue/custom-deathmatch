-- ── 상점: '평온의 부적' 소비아이템 (150 CDP) ──────────────────────────────
--
-- 랭크 매칭 시 자동 1개 소모.
-- 실제 카운터 매치 확률은 평온만 1명 1/17, 2명 1/19.
-- 카운터 부적과 1명씩 상쇄되어 기본 1/15로 돌아간다.
-- kind = 'calm_charm'

INSERT INTO shop_items (id, type, name, description, price, payload, is_active, sort_order)
SELECT 'cdb50000-c000-0000-0000-000000080001',
       'consumable',
       '평온의 부적',
       '카운터 매치 확률이 내려간다. 자동사용되며, 랭크 게임 1판당 1개씩 사용된다.',
       150,
       '{"kind":"calm_charm","scope":"rank_match","auto_consume":true,"stockPerUnit":1}'::jsonb,
       true,
       83
WHERE NOT EXISTS (
  SELECT 1 FROM shop_items WHERE payload->>'kind' = 'calm_charm'
);
