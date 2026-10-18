-- ============================================================
-- 문의 답변 편지: 제목 '문의 답변 · {문의 제목}' → '문의하신 「{문의 제목}」에 답변드립니다.'
-- 본문은 답변만 (예전에는 같은 문장을 본문 첫 줄에 붙였다). 실행: SQL Editor.
-- 제목 100자 상한은 /api/admin/notify-inquiry-answered 와 같게 문의 제목 쪽을 줄인다.
-- ============================================================

UPDATE mailbox_items i
   SET title = '문의하신 「'
            || CASE
                 WHEN char_length(s.subject) > 100 - char_length('문의하신 「」에 답변드립니다.')
                   THEN left(s.subject, 100 - char_length('문의하신 「」에 답변드립니다.') - 1) || '…'
                 ELSE s.subject
               END
            || '」에 답변드립니다.',
       body = q.answer_body
  FROM inquiries q
  CROSS JOIN LATERAL (SELECT coalesce(nullif(btrim(q.title), ''), '문의') AS subject) s
 WHERE i.source_key = 'inquiry:' || q.id::text
   AND q.answer_body IS NOT NULL;
