-- ============================================================
-- 뽑기 레전드 칭호 교체: 영겁의 현무 → 무극의 백호
--  · S등급 상품 'legend_title_mystery' 가 이 칭호를 지급
--  · 글로벌 1회 한정 — 클레임 리셋으로 S등급 재활성화
-- ============================================================

-- 0) effect 허용값에 'baekho' 추가 (CHECK 제약 교체)
ALTER TABLE titles DROP CONSTRAINT titles_effect_check;
ALTER TABLE titles ADD CONSTRAINT titles_effect_check
  CHECK (effect IS NULL OR effect IN ('legend', 'xuanwu', 'baekho'));

-- 1) 칭호 등록 (effect 'baekho' = 서릿빛 은백 광채)
INSERT INTO titles (id, name, color, description, condition_text, is_system, is_legend, effect, is_active)
VALUES (
  '579470a7-6bca-413c-a84f-d4a27ef48970'::uuid,
  '무극의 백호', 'silver',
  '서쪽 하늘을 수호하는 흰 호랑이의 기운이 깃든 레전드 칭호.',
  'CDP 뽑기 S등급 (전 서버 1명)', false, true, 'baekho', true
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, effect = 'baekho', is_legend = true, is_active = true;

-- 2) 이전 레전드(영겁의 현무) 글로벌 클레임 리셋 → S등급 다시 뽑힘
DELETE FROM gacha_global_claims WHERE prize_def_id = 's_legend_mystery';
