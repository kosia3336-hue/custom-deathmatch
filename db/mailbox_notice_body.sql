-- ============================================================
-- 우편함 공지 편지: '새 공지 [분류]' + 본문=공지 제목 → '공지 [분류] 제목' + 본문=공지 본문.
-- 실행: SQL Editor. sync_and_list_mailbox 는 건드리지 않는다 — 넣는 순간 트리거가 고쳐 쓴다.
-- 이미 들어 있는 공지 편지도 같은 모양으로 바꾼다(읽음·삭제 상태는 그대로).
-- ============================================================

CREATE OR REPLACE FUNCTION mailbox_items_notice_format()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cat   text;
  v_title text;
  v_body  text;
BEGIN
  IF NEW.kind <> 'notice' OR NEW.source_key NOT LIKE 'notice:%' THEN
    RETURN NEW;
  END IF;
  SELECT n.category::text, n.title, n.body
    INTO v_cat, v_title, v_body
    FROM notices n
   WHERE n.id::text = substring(NEW.source_key FROM 8);
  IF FOUND THEN
    NEW.title := '공지 [' || mailbox_notice_category_label(v_cat) || '] ' || v_title;
    NEW.body  := coalesce(v_body, '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mailbox_items_notice_format ON mailbox_items;
CREATE TRIGGER mailbox_items_notice_format
  BEFORE INSERT ON mailbox_items
  FOR EACH ROW EXECUTE FUNCTION mailbox_items_notice_format();

UPDATE mailbox_items i
   SET title = '공지 [' || mailbox_notice_category_label(n.category::text) || '] ' || n.title,
       body  = coalesce(n.body, '')
  FROM notices n
 WHERE i.kind = 'notice'
   AND i.source_key = 'notice:' || n.id::text;
