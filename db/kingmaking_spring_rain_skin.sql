begin;

insert into public.skins (id, game_id, name, description, is_active)
values (
  'skin-g023-01',
  'game-023',
  '봄비',
  '봄비가 멈춘 정원의 웅덩이 판. 연잎 말이 쌓이고 착수 자리에 물결이 퍼진다.',
  true
)
on conflict (id) do update
set
  game_id = excluded.game_id,
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

commit;
