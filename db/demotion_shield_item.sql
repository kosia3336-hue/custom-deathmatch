-- ── 상점: '강등 보호권' (550 CDP) — 데브 상점 전용 ────────────────────────────
--
-- 랭크 패배로 티어가 내려갈 때만 자동 1개 소모.
-- 발동하면 티어는 유지하고 RP만 0에서 멈춘다.
-- 패배 전 RP가 이미 0이면 소모하지 않고 강등된다.
-- 강등이 아닌 패배(RP가 0 이상에 남는 경우, 브론즈)에는 소모하지 않는다.

INSERT INTO shop_items (id, type, name, description, price, payload, is_active, sort_order)
SELECT 'cdb50000-c000-0000-0000-000000090001',
       'consumable',
       '강등 보호권',
       '강등될 상황에서 자동으로 사용된다. 강등되지 않고 0 RP에서 멈춘다. 이미 0 RP이면 사용되지 않고 강등된다.',
       550,
       '{"kind":"demotion_shield","scope":"rank_match","auto_consume":true,"stockPerUnit":1,"devOnly":true}'::jsonb,
       false,
       82
WHERE NOT EXISTS (
  SELECT 1 FROM shop_items WHERE payload->>'kind' = 'demotion_shield'
);
