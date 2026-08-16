-- 상점 이펙트 7일권: 누군가 영구 보유하면 전역 판매 중지.
-- 개발자 천하 보유는 집계에서 제외.
--
-- 실행: apply_migration 또는 대시보드 SQL Editor

CREATE OR REPLACE FUNCTION public.is_dev_effect_holder(p_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM members m
     WHERE m.id = p_member_id
       AND (
         m.nickname = '천하'
         OR m.id = 'd33913c1-a5d8-4781-a64e-ca9f9a4fce3a'::uuid
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.shop_permanently_claimed_effect_ids()
RETURNS TABLE(effect_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT mte.effect_id
    FROM member_title_effects mte
   WHERE mte.revoked_at IS NULL
     AND mte.expires_at IS NULL
     AND NOT public.is_dev_effect_holder(mte.member_id);
$$;

REVOKE ALL ON FUNCTION public.is_dev_effect_holder(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_dev_effect_holder(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.shop_permanently_claimed_effect_ids() TO anon, authenticated, service_role;
