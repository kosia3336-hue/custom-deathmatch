-- 콰트로 게임 등록 (Supabase SQL Editor 에서 실행)
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo, is_active, sort_order)
VALUES ('game-017', '콰트로',
        '4문양(스페이드·다이아·하트·클로버) 카드를 한 장씩 모아 콰트로를 완성하는 심리 카드게임. 가상 플레이어 6명과의 교환 심리전!',
        2, 2, true, false, false, true, 170)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    supports_multi = true, supports_com = false, supports_solo = false,
    is_active = true;
