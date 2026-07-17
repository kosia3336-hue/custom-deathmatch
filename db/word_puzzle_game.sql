-- 단어조합(구 단어 퍼즐) 게임 등록 (Supabase SQL Editor 에서 실행)
-- 주의: is_active = true 로 재활성화하므로 테스트 완료 전에는 실행하지 말 것
-- 비활성 상태에서 명칭만 먼저 바꾸려면:
--   UPDATE games SET name = '단어조합' WHERE id = 'game-018';
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, is_active, sort_order)
VALUES ('game-018', '단어조합',
        '3글자 단어 3개가 흩어진 9칸 격자에서 원래 단어를 먼저 조합하는 스피드 언어 퍼즐!',
        2, 2, true, false, false, true, 180)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description,
    supports_multi = true, supports_com = false, supports_solo = false, is_active = true;
