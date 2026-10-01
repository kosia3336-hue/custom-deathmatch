-- rank_match_history 조회를 "그 경기의 두 사람 + 관리자"로 좁힌다.
--
-- 왜: 지금은 SELECT 가 전체 공개라, 브라우저에서 공개 키로 이 표를 직접 조회하면
--     winner_id / loser_id / game_id / played_at 로 누가 누구와 붙었는지 알 수 있다.
--     members.nickname 도 공개라 익명 물약을 쓴 판의 상대가 누구인지 화면을 거치지 않고 드러난다.
--
-- 영향: 화면에서 이 표를 사용자 세션으로 읽는 곳은 마이페이지 랭크 탭뿐이고(본인 행만 읽음),
--       길드 점수·더미·히든 칭호·관리자 기능은 service_role 이라 RLS 영향이 없다.
--
-- 실행: Supabase SQL Editor 에서 1) 확인 → 2) 적용 순서로.

-- 1) 현재 정책 확인 (SELECT 정책 이름을 본다)
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename = 'rank_match_history';

-- 2) 공개 SELECT 정책을 지우고 본인·관리자 전용으로 교체
begin;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'rank_match_history' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.rank_match_history', p.policyname);
  end loop;
end $$;

create policy rank_match_history_select_own
  on public.rank_match_history
  for select
  to authenticated
  using (winner_id = auth.uid() or loser_id = auth.uid() or public.is_admin());

commit;
