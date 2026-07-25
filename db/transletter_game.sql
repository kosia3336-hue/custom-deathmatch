-- 트랜스레터 게임 등록 (Supabase SQL Editor 에서 실행)
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, is_active, sort_order)
VALUES ('game-019', '트랜스레터',
        '각 글자의 자음·모음 하나가 바뀐 단어를 주제 힌트를 보고 원래 단어로 되돌리는 2인 스피드 게임. 제한시간 10분 안에 3문제를 먼저 다 맞히면 승리!',
        2, 2, true, false, false, true, 180)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    supports_multi = true, supports_com = false, supports_solo = false, is_active = true;
