-- ============================================================
-- 슈퍼 AI 전용 기보. 운영 game_logs / 전적 / 칭호에 넣지 않는다.
-- 실행: SQL Editor 또는 apply_migration. 기존 길드 RPC·테이블 안 건드림.
-- 쓰기: 소켓 서버 service_role INSERT. 클라 직접 INSERT 없음.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.super_ai_games (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id            text NOT NULL,
  member_id          uuid REFERENCES public.members(id) ON DELETE SET NULL,
  room_id            text,
  winner_side        text,
  win_type           text,
  total_turns        int4 NOT NULL DEFAULT 0,
  play_time_seconds  int4 NOT NULL DEFAULT 0,
  ai_turns           int4 NOT NULL DEFAULT 0,
  finished           boolean NOT NULL DEFAULT true,
  kifu               jsonb NOT NULL DEFAULT '{}'::jsonb,
  engine             jsonb NOT NULL DEFAULT '{"kind":"super","thinkMs":180000}'::jsonb,
  played_at          timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.super_ai_games IS
  '슈퍼 AI 솔로 기보. game_logs와 분리. kifu = 게임 모듈 gameResultData (actions[].byAi).';

CREATE INDEX IF NOT EXISTS super_ai_games_member_played_at_idx
  ON public.super_ai_games (member_id, played_at DESC);

CREATE INDEX IF NOT EXISTS super_ai_games_game_played_at_idx
  ON public.super_ai_games (game_id, played_at DESC);

ALTER TABLE public.super_ai_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_ai_games_select_own ON public.super_ai_games;
CREATE POLICY super_ai_games_select_own
  ON public.super_ai_games
  FOR SELECT
  USING (is_admin() OR member_id = current_member_id());

GRANT SELECT ON TABLE public.super_ai_games TO authenticated;
GRANT ALL ON TABLE public.super_ai_games TO service_role;
REVOKE ALL ON TABLE public.super_ai_games FROM anon;
