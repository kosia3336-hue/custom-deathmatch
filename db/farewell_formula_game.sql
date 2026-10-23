-- 이별 공식(game-033) 등록. Supabase SQL Editor에서 1회 실행한다.
--
-- 잘못된 수식에서 지정된 횟수만큼 숫자·기호를 지워 올바른 등식을 먼저 만드는
-- 7라운드 게임. 정답 +1점, 4점 선취 시 판정승. 멀티/COM/솔로 지원.
--
-- game-031은 기존 '모음이 없어요'가 사용하므로 덮어쓰지 않는다.
-- 출시 전에는 lib/unreleasedGames.ts 의 game-033 항목으로 일반 사용자에게 숨긴다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-033', '이별 공식',
        '잘못된 수식에서 지정된 횟수만큼 숫자와 기호를 지워 올바른 등식을 먼저 완성하는 7라운드 게임',
        2, 2, true, true, true, false, true, 330, false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    min_players = EXCLUDED.min_players,
    max_players = EXCLUDED.max_players,
    supports_multi = EXCLUDED.supports_multi,
    supports_com = EXCLUDED.supports_com,
    supports_solo = EXCLUDED.supports_solo,
    supports_tutorial = EXCLUDED.supports_tutorial,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    ranking_active = EXCLUDED.ranking_active;

SELECT id, name, min_players, max_players, supports_multi, supports_com,
       supports_solo, supports_tutorial, is_active, ranking_active
  FROM games WHERE id = 'game-033';
