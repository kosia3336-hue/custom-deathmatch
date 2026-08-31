-- ============================================================
-- 홍련의 주작 칭호를 상점에 올린다.
--
-- ⚠️ 먼저 db/jujak_title.sql 을 실행해 titles 에 칭호가 있어야 한다.
--    칭호가 없으면 아래 INSERT 는 아무것도 넣지 않고 조용히 끝난다
--    (WHERE EXISTS 로 막아 둔다). 확인 쿼리로 결과를 볼 것.
--
-- 구매 처리는 purchase_shop_item() 이 payload->>'title_id' 를 읽어
-- member_titles 에 넣는 방식이다. bias 칭호가 아니므로 bias_* 는 넣지 않는다.
--
-- 여러 번 실행해도 안전하다. 같은 title_id 를 가리키는 상품이 이미 있으면
-- 값만 갱신한다.
-- ============================================================

INSERT INTO shop_items (type, name, description, price, payload, is_active, is_limited, sort_order)
SELECT
  'title',
  t.name,
  t.description,
  3500,
  jsonb_build_object('unique', true, 'subtype', 'special', 'title_id', t.id),
  true,
  false,
  101
FROM titles t
WHERE t.id = 'd7a7f07d-a160-4f8a-b982-d5794db257ae'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM shop_items si
     WHERE si.payload->>'title_id' = t.id::text
  );

-- 이미 올라와 있으면 이름·설명·가격만 최신으로 맞춘다.
UPDATE shop_items si
   SET name = t.name,
       description = t.description,
       price = 3500,
       is_active = true,
       updated_at = now()
  FROM titles t
 WHERE t.id = 'd7a7f07d-a160-4f8a-b982-d5794db257ae'::uuid
   AND si.payload->>'title_id' = t.id::text;

-- 확인.
SELECT si.id, si.type, si.name, si.price, si.is_active, si.sort_order, si.payload
  FROM shop_items si
 WHERE si.payload->>'title_id' = 'd7a7f07d-a160-4f8a-b982-d5794db257ae';
