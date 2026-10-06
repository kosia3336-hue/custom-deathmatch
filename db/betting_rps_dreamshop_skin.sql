-- 스킨 마스터 등록. 개인 보유/착용은 기존 member_skins·equip_skin 경로 사용.
-- 사용자가 배포를 요청할 때 운영 DB에 적용한다.
begin;
insert into public.skins (id, game_id, name, description, is_active)
values ('skin-g006-01', 'game-006', '드림샵',
 '민트 포인트, 굵은 검정 선과 단단한 그림자. 승·무·패와 베팅 결과가 귀여운 신스 음으로 울리는 네오 브루탈리즘.', true)
on conflict (id) do update set game_id=excluded.game_id, name=excluded.name,
 description=excluded.description, is_active=excluded.is_active;
commit;
