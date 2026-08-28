begin;

insert into public.skins (id, game_id, name, description, is_active)
values (
  'skin-g014-01',
  'game-014',
  '심야금고',
  '한밤의 비밀 금고. 황동 장부와 가상 지폐 위에서 펼쳐지는 은행가의 심리전.',
  true
)
on conflict (id) do update
set
  game_id = excluded.game_id,
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

commit;
