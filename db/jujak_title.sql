-- ============================================================
-- 레전드 칭호: 홍련의 주작
--  · effect 'jujak' = 중앙에서 번지는 홍련 화염 + 낙하 깃털 점화
--  · 기존 레전드 칭호는 유지하고 새 칭호만 등록한다
-- ============================================================

ALTER TABLE titles DROP CONSTRAINT IF EXISTS titles_effect_check;
ALTER TABLE titles ADD CONSTRAINT titles_effect_check
  CHECK (effect IS NULL OR effect IN (
    'legend', 'xuanwu', 'baekho', 'jujak', 'eternal',
    'issen', 'seongha', 'sakura', 'frost', 'lightning', 'wave', 'dojang'
  ));

INSERT INTO titles (
  id, name, color, description, condition_text,
  is_system, is_legend, effect, is_active
)
VALUES (
  'd7a7f07d-a160-4f8a-b982-d5794db257ae'::uuid,
  '홍련의 주작', 'red',
  '남쪽 하늘의 불꽃과 다시 태어나는 붉은 새의 기운이 깃든 레전드 칭호.',
  '특별 한정 칭호', false, true, 'jujak', true
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  condition_text = EXCLUDED.condition_text,
  effect = EXCLUDED.effect,
  is_legend = true,
  is_active = true;
