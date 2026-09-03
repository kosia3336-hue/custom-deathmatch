begin;

insert into public.skins (id, game_id, name, description, is_active)
values (
  'skin-g017-01',
  'game-017',
  '포카드',
  '에메랄드 펠트 위의 클래식 카지노. 트럼프 카드와 달빛 조커로 완성하는 콰트로.',
  true
)
on conflict (id) do update
set
  game_id = excluded.game_id,
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

commit;
