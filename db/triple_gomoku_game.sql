-- 삼층 오목(game-024) 등록. Supabase SQL Editor에서 1회 실행한다.
--
-- 반지름 5 삼각격자에서 각자 돌 25개로 진행한다.
-- 판은 육각형의 여섯 모서리를 도려낸 85칸이다(로비 설명 문구에는 칸 수가 없어 재실행 불필요).
-- 기본 배치는 1-2-2-1 순서로 각자 3개씩 놓고 시작한다.
-- ranking_active=false: 신규 게임 검증 기간에는 캐주얼 방에서만 플레이한다.
--
-- ⚠️ 이 파일은 name·description 을 EXCLUDED 로 덮어쓰므로, 사양이 바뀌면
--    다시 실행해야 로비 설명이 최신 상태가 된다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, supports_tutorial,
                   is_active, sort_order, ranking_active)
VALUES ('game-024', '삼층 오목',
        '삼각격자에 돌을 3층까지 쌓아 오목·3층 다섯 개·붙은 3층 세 개 중 하나를 먼저 만드는 1:1 추상전략',
        2, 2, true, true, false, false, true, 240, false)
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
  FROM games WHERE id = 'game-024';
