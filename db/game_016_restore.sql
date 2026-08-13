-- ─────────────────────────────────────────────────────────────
-- 해달별 (이벤트) — games 행 복구
--
--   game-016 의 games 행이 통째로 사라져 있었다. 코드(GAME_IDS,
--   smsEventRoom, lib/gameRules)에는 그대로 남아 있어 이벤트 방 자체는
--   돌아가지만(방 제목·게임명은 하드코딩), 서버의 게임 목록에는 안 잡혀
--   /api/games 가 18개만 내려주고 getGameById('game-016') 도 undefined 다.
--
--   값은 형제 이벤트 게임인 game-015(인디언홀덤 이벤트)와
--   shared/types/sun-moon-star-event.ts 의 좌석 수를 기준으로 맞췄다.
--     SMSE_MIN_PLAYERS = 4 / SMSE_MAX_SEATS = 8
--
--   ranking_active = false : 랭크 밴픽 풀에 넣지 않는다(이벤트 게임).
--   supports_com/solo = false : 시스템 이벤트 룸에서만 진행된다.
--
--   ⚠ 이 게임의 과거 전적은 원래부터 없었다(game_logs·member_game_stats·
--     rank_match_history 모두 0행). 연쇄 삭제로 유실된 것이 아니라,
--     이벤트 점수를 별도 시즌 테이블로 관리했기 때문이다. 따라서 이 INSERT
--     하나로 복구가 끝난다.
-- 실행: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo,
                   is_active, sort_order, ranking_active)
VALUES ('game-016', '해달별 (이벤트)',
        '운영 시간에 진행되는 최대 8인 해달별. 빛가루를 걸고 마크를 골라 칩을 겨룹니다.',
        4, 8, true, false, false, true, 151, false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    min_players = EXCLUDED.min_players,
    max_players = EXCLUDED.max_players,
    supports_multi = true, supports_com = false, supports_solo = false,
    is_active = true, ranking_active = false;

-- 확인 — 1행, is_active=true 로 나와야 한다
SELECT id, name, min_players, max_players, is_active, ranking_active
  FROM games WHERE id = 'game-016';
