-- ============================================================
-- 레전드 칭호 '영원의 군주' 추가
--  · effect 'eternal' = 청록/시안 shimmer + glow (불멸의 정점류 legend 이펙트의 청록 버전)
--  · 관리자 수동 부여용 — 뽑기 S등급(LEGEND_TITLE_ID)은 기존 '무극의 백호' 유지
-- 실행: Supabase SQL Editor
-- ============================================================

-- 0) effect 허용값에 'eternal' 추가 (CHECK 제약 교체)
--    ※ 기존 값(legend/xuanwu/baekho)을 반드시 함께 나열해야 한다 —
--      빠뜨리면 해당 값을 쓰는 기존 행 때문에 제약 추가가 실패한다.
ALTER TABLE titles DROP CONSTRAINT IF EXISTS titles_effect_check;
ALTER TABLE titles ADD CONSTRAINT titles_effect_check
  CHECK (effect IS NULL OR effect IN ('legend', 'xuanwu', 'baekho', 'eternal'));

-- 1) 칭호 등록
INSERT INTO titles (name, color, description, condition_text, is_system, is_legend, effect, is_active)
VALUES (
  '영원의 군주',
  'teal',
  '시간의 끝에서도 스러지지 않는 지배자의 증표.',
  '시즌2 챌린저 1위 마감',
  false,   -- 히든 아님
  true,    -- 레전드
  'eternal',
  true
)
ON CONFLICT (name) DO UPDATE
SET effect = 'eternal', is_legend = true, is_active = true;

-- 2) (선택) 특정 회원에게 지급
-- INSERT INTO member_titles (member_id, title_id)
-- SELECT '<member_uuid>'::uuid, id FROM titles WHERE name = '영원의 군주';
