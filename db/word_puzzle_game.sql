-- 단어 퍼즐 게임 등록 (Supabase SQL Editor 에서 실행 — 이미 서비스 롤로 반영됨)
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, is_active, sort_order)
VALUES ('game-018', '단어 퍼즐',
        '3글자 단어 3개가 흩어진 9칸 격자에서 원래 단어를 먼저 조합하는 스피드 언어 퍼즐!',
        2, 2, true, false, false, true, 180)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    supports_multi = true, supports_com = false, supports_solo = false, is_active = true;
