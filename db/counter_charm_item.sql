-- ── 상점: '카운터 부적' 소비아이템 (200 CDP) ──────────────────────────────
--
-- 랭크 매칭 시 자동 1개 소모. 설명은 확률만 올라간다고 적고,
-- 실제 카운터 매치 확률은 부적 사용자 0명 1/15, 1명 1/13, 2명 1/11.
-- kind = 'counter_charm' (kind 컬럼은 free-text).
--
-- 멱등: payload->>'kind' = 'counter_charm' 이 없을 때만 삽입.

INSERT INTO shop_items (id, type, name, description, price, payload, is_active, sort_order)
SELECT 'cdb50000-c000-0000-0000-000000070001',
       'consumable',
       '카운터 부적',
       '카운터 매치 확률이 올라간다. 자동사용되며, 랭크 게임 1판당 1개씩 사용된다.',
       200,
       '{"kind":"counter_charm","scope":"rank_match","auto_consume":true,"stockPerUnit":1,"devOnly":true}'::jsonb,
       false,
       84
WHERE NOT EXISTS (
  SELECT 1 FROM shop_items WHERE payload->>'kind' = 'counter_charm'
);

-- 관리자 지급 화이트리스트에 counter_charm 추가 (기존 kind 유지)
CREATE OR REPLACE FUNCTION public.admin_grant_consumable(p_actor_id uuid, p_member_id uuid, p_kind text, p_delta integer, p_reason text)
 RETURNS TABLE(count_after integer, applied_delta integer, clamped boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count   integer;
  v_next    integer;
  v_applied integer;
  v_clamped boolean := false;
BEGIN
  IF p_delta = 0 THEN RAISE EXCEPTION 'delta_zero'; END IF;
  IF p_delta < -1000 OR p_delta > 1000 THEN RAISE EXCEPTION 'delta_out_of_range'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR length(p_reason) > 200 THEN
    RAISE EXCEPTION 'reason_invalid';
  END IF;
  IF p_kind NOT IN ('nickname_change','rank_reset','spectator_lock','anonymity','magnifier','ban_eraser','counter_charm','calm_charm','demotion_shield') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  INSERT INTO shop_consumable_inventory(member_id, kind, count)
  VALUES (p_member_id, p_kind, 0)
  ON CONFLICT (member_id, kind) DO NOTHING;

  SELECT count INTO v_count FROM shop_consumable_inventory
   WHERE member_id = p_member_id AND kind = p_kind FOR UPDATE;

  v_next := v_count + p_delta;
  IF v_next < 0 THEN
    v_applied := -v_count;
    v_next    := 0;
    v_clamped := true;
  ELSE
    v_applied := p_delta;
  END IF;

  UPDATE shop_consumable_inventory
     SET count      = v_next,
         updated_at = now()
   WHERE member_id = p_member_id AND kind = p_kind;

  INSERT INTO admin_actions (actor_id, action_kind, target_kind, target_id, payload)
  VALUES (
    p_actor_id, 'shop.consumable_adjust', 'shop_consumable',
    (p_member_id::text || '/' || p_kind),
    jsonb_build_object(
      'kind',            p_kind,
      'requested_delta', p_delta,
      'applied_delta',   v_applied,
      'clamped',         v_clamped,
      'before',          v_count,
      'after',           v_next,
      'reason',          p_reason
    )
  );

  RETURN QUERY SELECT v_next, v_applied, v_clamped;
END;
$function$;
