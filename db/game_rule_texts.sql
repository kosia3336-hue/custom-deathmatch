-- ============================================================
-- 게임 룰 텍스트 (관리자 페이지에서 작성/수정)
--  - lib/gameRules.ts 의 GAME_RULES 목록이 기준 (id = game-001 ...)
--  - 이 테이블의 rules(마크다운)가 있으면 정적 파일 값보다 우선 적용
--  - 쓰기는 service_role(관리자 API) 전용, 읽기는 공개
-- ============================================================

CREATE TABLE IF NOT EXISTS game_rule_texts (
  game_id         text PRIMARY KEY,
  rules           text NOT NULL DEFAULT '',
  source          text NOT NULL DEFAULT '',  -- 출처 (예: OO 예능, 보드게임 원작명)
  origin_url      text NOT NULL DEFAULT '',  -- 원본 룰 링크
  original_author text NOT NULL DEFAULT '',  -- 원작자
  poster          text NOT NULL DEFAULT '',  -- 게시자 (표시용)
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES members(id)
);

-- 기존 테이블에 컬럼 추가 (이미 생성한 경우 대비)
ALTER TABLE game_rule_texts ADD COLUMN IF NOT EXISTS source          text NOT NULL DEFAULT '';
ALTER TABLE game_rule_texts ADD COLUMN IF NOT EXISTS origin_url      text NOT NULL DEFAULT '';
ALTER TABLE game_rule_texts ADD COLUMN IF NOT EXISTS original_author text NOT NULL DEFAULT '';
ALTER TABLE game_rule_texts ADD COLUMN IF NOT EXISTS poster          text NOT NULL DEFAULT '';

ALTER TABLE game_rule_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_rule_texts_read ON game_rule_texts;
CREATE POLICY game_rule_texts_read ON game_rule_texts FOR SELECT USING (true);
