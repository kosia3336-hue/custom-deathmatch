-- 삼층 오목(game-024)·킹메이킹(game-023) 1:1 솔로 모드 열기.
--
-- 서버·화면은 이미 솔로를 지원한다(soloReviewSeats 로 선·후 두 자리를 만들고,
-- 화면은 차례 주인을 '나' 로 본다). 막고 있던 것은 이 플래그 하나뿐이다.
-- 여러 번 실행해도 결과가 같다.

begin;

do $$
declare
  v_ids text[] := array['game-023', 'game-024'];
  v_found integer;
  v_changed integer;
begin
  select count(*) into v_found from public.games where id = any(v_ids);
  if v_found <> 2 then
    raise exception 'games 에 두 게임이 모두 있어야 한다 (찾은 수: %)', v_found;
  end if;

  update public.games
     set supports_solo = true
   where id = any(v_ids)
     and supports_solo is distinct from true;

  get diagnostics v_changed = row_count;
  raise notice '솔로 허용으로 바꾼 게임: %건', v_changed;
end
$$;

commit;

-- 결과 확인
select id, name, supports_multi, supports_com, supports_solo
  from public.games
 where id in ('game-023', 'game-024')
 order by id;
