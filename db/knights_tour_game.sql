-- 나이트의 여행(game-022) 등록. Supabase SQL Editor에서 1회 실행한다.
insert into games (
  id,
  name,
  description,
  min_players,
  max_players,
  supports_multi,
  supports_com,
  supports_solo,
  supports_tutorial,
  is_active,
  sort_order,
  ranking_active,
  created_at
) values (
  'game-022',
  '나이트의 여행',
  '다양한 모양의 보드를 나이트로 먼저 완주하는 최대 7라운드 관찰 레이스. 4점 선취 시 판정승!',
  2,
  2,
  true,
  true,
  true,
  false,
  true,
  220,
  false,
  now()
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  min_players = excluded.min_players,
  max_players = excluded.max_players,
  supports_multi = excluded.supports_multi,
  supports_com = excluded.supports_com,
  supports_solo = excluded.supports_solo,
  supports_tutorial = excluded.supports_tutorial,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  ranking_active = excluded.ranking_active;
