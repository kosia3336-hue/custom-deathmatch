-- 모음이 없어요(game-031) 등록. Supabase SQL Editor에서 1회 실행한다.
--
-- 모음을 지우고 자음만 남긴 단어(ㅂㅇㅅㅇㄱㄱ → 방송국)를 주제 힌트로 맞히는 2인 스피드 게임.
-- 판 규칙은 트랜스레터와 같다(3문제·10분). 멀티 + 1인 솔로, COM 없음.
-- ranking_active=false: 검증 기간에는 캐주얼 방에서만.
--
-- 순서: main 배포 → 이 SQL 실행 → 소켓 서버 재시작(npx pm2 restart genius-server).
-- 출시 전에는 lib/unreleasedGames.ts 에 'game-031' 이 있어 일반 사용자 화면에서 숨는다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-031', '모음이 없어요',
        '모음이 지워지고 자음만 남은 단어를 주제 힌트를 보고 원래 단어로 맞히는 2인 스피드 게임. 제한시간 10분 안에 3문제를 먼저 다 맞히면 승리!',
        2, 2, true, false, true, false, true, 310, false)
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
  FROM games WHERE id = 'game-031';
