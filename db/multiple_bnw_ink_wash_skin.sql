begin;

insert into public.skins (id, game_id, name, description, is_active)
values (
  'skin-g007-01',
  'game-007',
  '묵연',
  '한지 위로 번지는 먹빛 산수. 백자와 먹돌 타일로 펼치는 고요한 수 싸움.',
  true
)
on conflict (id) do update
set
  game_id = excluded.game_id,
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

commit;
