-- 킹메이킹(game-023) 등록. game-022는 나이트의 여행에서 사용한다.
-- Supabase SQL Editor에서 1회 실행한다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-023', '킹메이킹',
        '5×5 보드에서 탑을 분할 이동해 6층의 왕을 만드는 1:1 추상전략 게임',
        2, 2, true, true, false, false, true, 230, false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    min_players = 2,
    max_players = 2,
    supports_multi = true,
    supports_com = true,
    supports_solo = false,
    supports_tutorial = false,
    is_active = true,
    sort_order = EXCLUDED.sort_order,
    ranking_active = false;

SELECT id, name, min_players, max_players, supports_multi, supports_com,
       supports_solo, supports_tutorial, is_active, ranking_active
  FROM games WHERE id = 'game-023';
