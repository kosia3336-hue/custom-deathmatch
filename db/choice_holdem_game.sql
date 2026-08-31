-- 초이스 홀덤(game-025) 등록. Supabase SQL Editor에서 1회 실행한다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-025', '초이스 홀덤',
        '1부터 5까지의 카드로 조합을 만들고 카드 선택과 두 차례 베팅을 겨루는 1:1 게임',
        2, 2, true, true, false, false, true, 250, false)
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
  FROM games WHERE id = 'game-025';
