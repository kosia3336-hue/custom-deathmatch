-- ============================================================
-- 1회. 우편함 컷오프를 전 kind에 맞춤.
--   기존 회원(컷오프 > 가입일): 지금부터.
--   뉴비(컷오프 = 가입일): 유지.
-- 재실행하면 기존 회원 컷오프가 또 지금이 된다.
-- 함수 정본은 db/mailbox.sql. 이 파일은 데이터만.
-- ============================================================

UPDATE mailbox_prefs p
   SET notice_since = now()
  FROM members m
 WHERE m.id = p.member_id
   AND p.notice_since > m.created_at + interval '1 minute';

DELETE FROM mailbox_items i
 USING mailbox_prefs p
 WHERE i.member_id = p.member_id
   AND i.created_at < p.notice_since;
