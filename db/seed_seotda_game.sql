-- 시드섯다(game-026) 등록. Supabase SQL Editor에서 1회 실행한다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-026', '시드섯다',
        '공용 시드패와 개인 패를 선택해 섯다 족보를 만들고 베팅하는 1:1 카드 게임',
        2, 2, true, true, false, false, true, 260, false)
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
  FROM games WHERE id = 'game-026';
