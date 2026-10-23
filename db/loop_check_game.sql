-- 루프체크(game-032). 검증 기간에는 랭크에서 제외한다.
insert into games (
  id, name, description, min_players, max_players,
  supports_multi, supports_com, supports_solo, supports_tutorial,
  is_active, sort_order, ranking_active
) values (
  'game-032', '루프체크',
  '6×6 모자이크에서 서로 다른 5색이 두 번 반복되는 10칸 경로를 찾는 관찰 게임. 기본 5전 3선승, 색약 모드 지원.',
  2, 2, true, true, true, false, true, 320, false
)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  min_players = excluded.min_players, max_players = excluded.max_players,
  supports_multi = excluded.supports_multi, supports_com = excluded.supports_com,
  supports_solo = excluded.supports_solo, supports_tutorial = excluded.supports_tutorial,
  is_active = excluded.is_active, sort_order = excluded.sort_order,
  ranking_active = excluded.ranking_active;

select id, name, supports_multi, supports_com, supports_solo, ranking_active
from games where id = 'game-032';
