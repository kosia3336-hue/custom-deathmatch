-- 랭킹 검색 팀. 실행: Supabase migration.

create table if not exists public.ranking_teams (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique
);

create table if not exists public.ranking_team_members (
  team_id uuid not null references public.ranking_teams(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  primary key (team_id, member_id)
);

alter table public.ranking_teams enable row level security;
alter table public.ranking_team_members enable row level security;

drop policy if exists ranking_teams_read on public.ranking_teams;
create policy ranking_teams_read
  on public.ranking_teams
  for select
  to public
  using (true);

drop policy if exists ranking_team_members_read on public.ranking_team_members;
create policy ranking_team_members_read
  on public.ranking_team_members
  for select
  to public
  using (true);

grant select on public.ranking_teams to anon, authenticated;
grant select on public.ranking_team_members to anon, authenticated;

do $$
declare
  v_missing text;
  v_members int;
begin
  create temporary table ranking_team_roster (
    team_name citext not null,
    nickname citext not null
  ) on commit drop;

  insert into ranking_team_roster (team_name, nickname) values
    ('지미나이', '지니어스'),
    ('지미나이', 'chatgpt'),
    ('지미나이', '모아이'),
    ('지미나이', 'Suho'),
    ('지미나이', 'd1ckdgus'),
    ('지미나이', '조용한물겨리'),
    ('타짜', '아이큐'),
    ('타짜', '윈터'),
    ('타짜', 'Sylpher'),
    ('타짜', '럽둥이'),
    ('타짜', 'KV'),
    ('오합지존', '푸린'),
    ('오합지존', '샤인'),
    ('오합지존', '이셰일'),
    ('오합지존', '동구리오'),
    ('오합지존', '매로나'),
    ('신살자', '삼디'),
    ('신살자', '러각'),
    ('신살자', '동현'),
    ('신살자', '숭봉'),
    ('신살자', '설펭'),
    ('유플래쉬', 'UzPlay'),
    ('유플래쉬', '민우'),
    ('유플래쉬', '집가'),
    ('유플래쉬', '애용'),
    ('유플래쉬', '롤탈'),
    ('왜토라조곰탱', 'L라블'),
    ('왜토라조곰탱', '왜조리'),
    ('왜토라조곰탱', '민달'),
    ('왜토라조곰탱', '창조적인플레이'),
    ('왜토라조곰탱', '곰탱이'),
    ('리벤지', '태경'),
    ('리벤지', '운동돼지'),
    ('리벤지', '성민'),
    ('리벤지', 'Raisy'),
    ('리벤지', '쇼비'),
    ('리벤지', '쇼비2');

  select string_agg(r.nickname::text, ', ' order by r.nickname::text)
    into v_missing
    from ranking_team_roster r
    left join public.members m
      on m.nickname = r.nickname
     and m.withdrawn_at is null
   where m.id is null;

  if v_missing is not null then
    raise exception 'active member not found: %', v_missing;
  end if;

  insert into public.ranking_teams (name)
  select distinct team_name
    from ranking_team_roster
  on conflict (name) do nothing;

  insert into public.ranking_team_members (team_id, member_id)
  select t.id, m.id
    from ranking_team_roster r
    join public.ranking_teams t on t.name = r.team_name
    join public.members m
      on m.nickname = r.nickname
     and m.withdrawn_at is null
  on conflict (team_id, member_id) do nothing;

  select count(*) into v_members from public.ranking_team_members;
  if v_members <> 37 then
    raise exception 'expected 37 ranking team members, got %', v_members;
  end if;
end $$;
