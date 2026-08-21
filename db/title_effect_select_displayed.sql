-- 장착 중인 이펙트 보유 행만 공개 SELECT.
--
-- 배경: member_title_effects 는 본인(또는 관리자)만 읽을 수 있었다.
-- loadResolvedDisplayedTitle(s) 가 만료·보유 확인을 이 테이블에서 하므로,
-- 랭킹처럼 getServerSupabase(anon/남의 세션)로 합성하면 overlay 가 빠졌다.
-- 소켓 경로(service_role)는 원래 보였고, 본인이 로그인한 랭킹/GNB 만 보였다.
--
-- 공개하는 것: 지금 displayed_effect_id 로 장착 중인 활성 행의 만료 시각.
-- 인벤 전체(미장착 이펙트)는 기존 select_self 그대로 본인만.

DROP POLICY IF EXISTS member_title_effects_select_displayed ON public.member_title_effects;
CREATE POLICY member_title_effects_select_displayed
  ON public.member_title_effects
  FOR SELECT
  USING (
    revoked_at IS NULL
    AND EXISTS (
      SELECT 1
        FROM public.members m
       WHERE m.id = member_title_effects.member_id
         AND m.displayed_effect_id = member_title_effects.effect_id
    )
  );
