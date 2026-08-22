-- 수식완성N 게임 등록 (Supabase SQL Editor 에서 실행)
--
-- numberCount(4~6)는 방의 game_options로 전달되며 기본값은 4입니다.
-- supports_solo=true: 상대 없이 혼자 7라운드를 푸는 1:1 솔로(연습) 모드를 지원합니다.
-- ranking_active=false: 신규 게임 검증 기간에는 캐주얼 방에서만 플레이합니다.
-- 검증 완료 후 랭크 밴픽 풀에 넣으려면 true로 변경하세요.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo,
                   is_active, sort_order, ranking_active)
VALUES ('game-020', '수식완성N',
        'N개의 자연수를 각각 한 번씩 사용해 타깃넘버를 먼저 만드는 최대 7라운드 수식 대결. 정답은 +1점, 오답은 -1점, 4점 선취 시 판정승!',
        2, 2, true, false, true, true, 200, false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    min_players = 2,
    max_players = 2,
    supports_multi = true,
    supports_com = false,
    supports_solo = true,
    is_active = true,
    sort_order = EXCLUDED.sort_order,
    ranking_active = false;

SELECT id, name, min_players, max_players, supports_solo, is_active, ranking_active
  FROM games WHERE id = 'game-020';
