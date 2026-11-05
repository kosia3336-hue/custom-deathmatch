-- ============================================================
-- 창공의 청룡을 등록하고 뽑기 레전드 슬롯에 올린다.
--
--   1) titles 에 창공의 청룡 등록 (effect 'cheongryong' 허용 포함)
--   2) 이미 청구된 레전드 슬롯(s_legend_mystery)을 비워 다시 열기
--
-- 코드 쪽 LEGEND_TITLE_ID 는 청룡 UUID 로, S 등급 확률은 0.02% 로 바꿔 두었다.
-- 배포보다 먼저 실행하면 아직 주작을 가리키는 옛 코드에서 슬롯이 열려
-- 주작이 한 번 더 나갈 수 있다. 반드시 **배포 후에** 실행한다.
--
-- ⚠️ 2)는 홍련의 주작을 뽑았던 사람의 칭호를 빼앗지 않는다. member_titles 는
--    그대로 두고 "레전드는 전역 1회" 카운터만 초기화한다.
--
-- 여러 번 실행해도 안전하다.
-- ============================================================
BEGIN;

-- 기존 허용값(다른 브랜치에서 추가한 키 포함)을 보존하면서 청룡만 추가한다.
DO $migration$
DECLARE
  existing_check text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO existing_check
  FROM pg_constraint
  WHERE conrelid = 'public.titles'::regclass
    AND conname = 'titles_effect_check';

  -- 제약이 없으면 이미 새 effect를 허용하므로 추가 제한을 만들지 않는다.
  IF existing_check IS NOT NULL
    AND position(quote_literal('cheongryong') IN existing_check) = 0 THEN
    ALTER TABLE public.titles DROP CONSTRAINT titles_effect_check;
    EXECUTE format(
      'ALTER TABLE public.titles ADD CONSTRAINT titles_effect_check CHECK ((%s) OR effect = %L)',
      existing_check, 'cheongryong'
    );
  END IF;
END;
$migration$;

INSERT INTO public.titles (
  id, name, color, description, condition_text,
  is_system, is_legend, effect, is_active
) VALUES (
  '7eea94b7-dd34-42d6-b547-e48059e77ca0'::uuid,
  '창공의 청룡', 'azure',
  '푸른 용이 창공을 누비며 이름을 감싸는 레전드 칭호.', NULL,
  false, true, 'cheongryong', true
)
ON CONFLICT (name) DO UPDATE SET
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  effect = EXCLUDED.effect,
  is_legend = true,
  is_active = true;

-- 코드의 LEGEND_TITLE_ID 와 id 가 다르면(같은 이름의 행이 먼저 있었으면) 여기서 멈춘다.
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.titles
     WHERE id = '7eea94b7-dd34-42d6-b547-e48059e77ca0'::uuid AND name = '창공의 청룡'
  ) THEN
    RAISE EXCEPTION '창공의 청룡 id 가 LEGEND_TITLE_ID 와 다릅니다';
  END IF;
END;
$check$;

-- 2) 레전드 슬롯 다시 열기
DELETE FROM public.gacha_global_claims WHERE prize_def_id = 's_legend_mystery';

COMMIT;

-- 확인 — 칭호가 등록됐고 슬롯이 비어 있어야 한다.
SELECT id, name, color, effect, is_legend, is_active
  FROM public.titles
 WHERE id = '7eea94b7-dd34-42d6-b547-e48059e77ca0';

SELECT count(*) AS 남은_레전드_청구
  FROM public.gacha_global_claims
 WHERE prize_def_id = 's_legend_mystery';
