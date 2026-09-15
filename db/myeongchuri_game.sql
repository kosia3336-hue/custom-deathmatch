-- 명추리(game-028) 등록. Supabase SQL Editor에서 1회 실행한다.
--
-- 3×3 타일(A~I) 뒤에 숨은 숫자 5개·기호 4개를 4칸 수식의 결과로 추리하는 1:1 게임.
-- 멀티 전용(COM·솔로 없음). ranking_active=false: 신규 게임 검증 기간에는 캐주얼 방에서만.
--
-- 순서: main 배포 → 이 SQL 실행 → 소켓 서버 재시작(npx pm2 restart genius-server).
-- 출시 전에는 lib/unreleasedGames.ts 에 'game-028' 이 있어 일반 사용자 화면에서 숨는다.
--
-- ⚠️ 이 파일은 name·description 을 EXCLUDED 로 덮어쓰므로, 사양이 바뀌면
--    다시 실행해야 로비 설명이 최신 상태가 된다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-028', '명추리',
        '3×3 타일 뒤에 숨은 숫자와 기호를 수식 결과로 추리해, 모두 먼저 맞히는 쪽이 이기는 1:1 추리 게임',
        2, 2, true, false, false, false, true, 280, false)
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
  FROM games WHERE id = 'game-028';
