-- 사각목(game-034) 등록. Supabase SQL Editor에서 1회 실행한다.
--
-- 6×5 판에 번갈아 말을 놓아(선 1 → 2개씩 → 후 1) 내 말 네 개로 만든 정사각형(기울어진 것 포함)의
-- 넓이 합을 겨루는 1:1 추상전략. 멀티만(COM·솔로 없음). ranking_active=false: 검증 기간에는 캐주얼 방에서만.
--
-- 순서: main 배포 → 이 SQL 실행 → 소켓 서버 재시작(npx pm2 restart genius-server).
-- 출시 전에는 lib/unreleasedGames.ts 에 SQUARE_MOK 이 있어 일반 사용자 화면에서 숨는다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-034', '사각목',
        '6×5 판에 번갈아 말을 놓아, 내 말 네 개로 만든 정사각형의 넓이만큼 승점을 얻는 1:1 추상전략 게임. 기울어진 정사각형도 인정!',
        2, 2, true, false, false, false, true, 340, false)
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
       supports_solo, is_active, ranking_active
  FROM games WHERE id = 'game-034';
