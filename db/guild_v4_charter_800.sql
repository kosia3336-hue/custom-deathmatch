-- 길드 창설권 1,500 → 800 CDP. 기존 16개 RPC·테이블 스키마는 건드리지 않는다.
UPDATE shop_items
   SET price = 800
 WHERE payload->>'kind' = 'guild_charter';
