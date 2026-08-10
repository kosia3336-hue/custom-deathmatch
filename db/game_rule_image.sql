-- ─────────────────────────────────────────────────────────────
-- 룰 이미지를 관리자 페이지에서 관리하도록 전환
--
--   전에는 룰지를 통째로 이미지로 구워 public/rules/<gameId>.webp 에 두었다.
--   폭이 좁아지면 글씨까지 같이 줄어들어 모바일에서 읽기 힘들었고, 이미지를
--   바꾸려면 코드 커밋 + 배포가 필요했다.
--
--   이제는 배경만 이미지로 깔고 룰 본문은 진짜 텍스트로 얹는다(RuleSheet).
--   image_url 은 '글로 설명하기 어려운 도해'(게임판·배치도 등)를 본문 위에
--   끼워 넣고 싶을 때만 쓴다. 비어 있으면 텍스트만 나온다.
--
--   업로드는 관리자 페이지 > 게임 룰 탭에서 한다(rule-images 버킷).
-- 실행: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

ALTER TABLE game_rule_texts
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';

-- 옛 통이미지(룰 본문이 그대로 박혀 있음)는 비운다.
-- 이제 같은 내용이 텍스트로 나오므로 그대로 두면 두 번 보인다.
UPDATE game_rule_texts
   SET image_url = ''
 WHERE image_url LIKE '/rules/game-%';

-- 확인 — 값이 남아 있는 행만 보인다(보통 0행)
SELECT game_id, image_url FROM game_rule_texts WHERE image_url <> '' ORDER BY game_id;
