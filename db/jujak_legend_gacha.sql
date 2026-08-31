-- ============================================================
-- 홍련의 주작을 뽑기 레전드 슬롯에 올린다.
--
-- 두 가지를 한다.
--   1) titles 에 홍련의 주작 등록 (effect 'jujak' 허용 포함)
--   2) 이미 청구된 레전드 슬롯(s_legend_mystery)을 비워 다시 열기
--
-- 코드 쪽 LEGEND_TITLE_ID 는 이미 주작 UUID 로 바꿔 두었다. 배포와 함께
-- 적용되므로, 이 SQL 은 배포 전후 아무 때나 실행해도 된다.
--
-- ⚠️ 2)는 무극의 백호를 뽑았던 사람의 칭호를 빼앗지 않는다. member_titles 는
--    그대로 두고, "레전드는 전역 1회" 카운터만 초기화한다. 백호는 이제
--    뽑기에 나오지 않고, 다음 레전드 당첨자는 주작을 가져간다.
--
-- 여러 번 실행해도 안전하다.
-- ============================================================

-- 1) 칭호 등록
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
SET name = EXCLUDED.name,
    color = EXCLUDED.color,
    description = EXCLUDED.description,
    condition_text = EXCLUDED.condition_text,
    effect = EXCLUDED.effect,
    is_legend = true,
    is_active = true;

-- 2) 레전드 슬롯 다시 열기
DELETE FROM gacha_global_claims WHERE prize_def_id = 's_legend_mystery';

-- 확인 — 칭호가 등록됐고 슬롯이 비어 있어야 한다.
SELECT id, name, color, effect, is_legend, is_active
  FROM titles
 WHERE id = 'd7a7f07d-a160-4f8a-b982-d5794db257ae';

SELECT count(*) AS 남은_레전드_청구
  FROM gacha_global_claims
 WHERE prize_def_id = 's_legend_mystery';
