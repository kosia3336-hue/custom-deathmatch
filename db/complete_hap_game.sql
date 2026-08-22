-- 컴플릿 결! 합! 게임 등록 (Supabase SQL Editor 에서 실행)
-- 27장 전체 덱을 9장짜리 보드 3개로 나눠 동시에 공개합니다.
-- 멀티는 방 시간설정을 사용하고, COM·1:1 솔로는 기본 10분 타임어택입니다.
-- ranking_active=false: 신규 게임 검증 기간에는 캐주얼 방에서만 플레이합니다.
INSERT INTO games (id, name, description, min_players, max_players,
                   supports_multi, supports_com, supports_solo,
                   is_active, sort_order, ranking_active)
VALUES ('game-021', '컴플릿 결! 합!',
        '세 개의 3×3 보드에서 문제마다 존재하는 모든 합을 상대보다 먼저 완성하는 관찰 대결.',
        2, 2, true, true, true, true, 210, false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    min_players = 2,
    max_players = 2,
    supports_multi = true,
    supports_com = true,
    supports_solo = true,
    is_active = true,
    sort_order = EXCLUDED.sort_order,
    ranking_active = false;

SELECT id, name, min_players, max_players, supports_multi, supports_com,
       supports_solo, is_active, ranking_active
  FROM games WHERE id = 'game-021';
