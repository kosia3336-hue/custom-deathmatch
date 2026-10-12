-- 에스키모(game-030) 등록. Supabase SQL Editor에서 1회 실행한다.
--
-- 5×5 판에서 자기 말을 미끄러뜨리거나 북극곰을 한 칸 옮겨, 북극곰의 사방을 먼저 막는 쪽이
-- 이기는 1:1 추상전략. 멀티 + COM(보통·어려움), 솔로 없음. ranking_active=false: 검증 기간에는 캐주얼 방에서만.
--
-- 순서: main 배포 → 이 SQL 실행 → 소켓 서버 재시작(npx pm2 restart genius-server).
-- 출시 전에는 lib/unreleasedGames.ts 에 'game-030' 이 있어 일반 사용자 화면에서 숨는다.
--
-- ⚠️ 이 파일은 name·description 을 EXCLUDED 로 덮어쓰므로, 사양이 바뀌면
--    다시 실행해야 로비 설명이 최신 상태가 된다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-030', '에스키모',
        '5×5 판에서 말을 미끄러뜨리거나 북극곰을 옮겨, 북극곰의 사방을 먼저 막는 쪽이 이기는 1:1 추상전략 게임',
        2, 2, true, true, false, false, true, 300, false)
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
  FROM games WHERE id = 'game-030';
