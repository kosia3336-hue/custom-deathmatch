-- 양면포커(game-027) 등록. Supabase SQL Editor에서 1회 실행한다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-027', '양면포커',
        '공개 앞면과 비공개 뒷면 중 한 면 또는 양면을 선택해 베팅하는 1:1 카드 게임',
        2, 2, true, true, false, false, true, 270, false)
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
  FROM games WHERE id = 'game-027';
