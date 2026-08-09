-- ─────────────────────────────────────────────────────────────
-- 룰 이미지를 관리자 페이지에서 관리하도록 전환
--
--   전에는 저장소 파일(public/rules/<gameId>.webp)이라 이미지를 바꾸려면
--   코드 커밋 + 배포가 필요했다. 이제 URL 을 DB 에 두고 관리자 페이지에서
--   업로드/교체/삭제한다(업로드는 rule-images 버킷).
--
--   image_url 이 비어 있으면 룰 페이지는 지금처럼 텍스트만 보여준다.
-- 실행: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

ALTER TABLE game_rule_texts
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';

-- 이미 저장소에 올라가 있던 3종은 그대로 이어 쓴다(같은 경로로 계속 서빙됨).
-- 관리자 페이지에서 새 이미지를 올리면 스토리지 URL 로 교체된다.
UPDATE game_rule_texts SET image_url = '/rules/game-002.webp' WHERE game_id = 'game-002' AND image_url = '';
UPDATE game_rule_texts SET image_url = '/rules/game-005.webp' WHERE game_id = 'game-005' AND image_url = '';
UPDATE game_rule_texts SET image_url = '/rules/game-010.webp' WHERE game_id = 'game-010' AND image_url = '';

-- 확인
SELECT game_id, image_url FROM game_rule_texts WHERE image_url <> '' ORDER BY game_id;
