-- 조각조각(game-035) 등록. Supabase SQL Editor에서 1회 실행한다.
--
-- 글자마다 초성·중성·종성 중 하나만 남은 조각(ㅍ ㅏ → 피자)을 주제 힌트로 맞히는 2인 라운드 게임.
-- 7라운드 4점 선취(7전 4승제), 라운드 60초. 멀티 + 1인 솔로, COM 없음.
-- ranking_active=false: 검증 기간에는 캐주얼 방에서만.
-- game-034 는 사각목(feat/square-mok)이 쓰므로 건너뛴다.
--
-- 순서: main 배포 → 이 SQL 실행 → 소켓 서버 재시작.
-- 출시 전에는 lib/unreleasedGames.ts 에 'game-035' 가 있어 일반 사용자 화면에서 숨는다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-035', '조각조각',
        '글자마다 초성·중성·종성 중 하나만 남은 조각을 보고 주제 힌트로 원래 단어를 맞히는 2인 게임. 같은 문제를 먼저 맞히면 1점, 7라운드 중 4점을 먼저 따면 승리!',
        2, 2, true, false, true, false, true, 350, false)
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
  FROM games WHERE id = 'game-035';
