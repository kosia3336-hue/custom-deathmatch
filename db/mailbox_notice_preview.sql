-- ============================================================
-- 우편함 공지 편지 본문을 앞부분(300자)만 저장 — Supabase 전송량 절약.
--
-- 우편함 목록(sync_and_list_mailbox)은 열 때마다 모든 편지의 본문을 내려보낸다.
-- 2026-10-18 에 공지 본문 전체를 넣은 뒤 한 번에 받는 양이 7KB → 22KB 로 늘었고,
-- 2026-10-24 무료 전송량 초과로 서비스가 멈추는 데 한몫했다.
-- 목록·미리보기는 앞부분으로 충분하고, 편지를 열면 화면이 /api/notices/:id/body 로 전체를 받는다.
--
-- 실행: SQL Editor. db/mailbox_notice_body.sql 의 트리거 함수를 덮어쓴다(제목 규칙은 그대로).
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
    NEW.body  := left(coalesce(v_body, ''), 300);
  END IF;
  RETURN NEW;
END;
$$;

UPDATE mailbox_items
   SET body = left(body, 300)
 WHERE kind = 'notice'
   AND char_length(body) > 300;
