-- ─────────────────────────────────────────────────────────────
-- linked_accounts 연결 경로 값 정리
--
-- '직접 연동'(내정보에서 사용자가 버튼을 눌러 연결) 기능을 없앴다.
-- 이제 연결이 생기는 경로는 둘뿐이다.
--
--   kakao_id : 같은 카카오 계정임이 확인되어 기존 커데매 회원에 연결
--   account  : 계정 서비스를 거쳐 커데매 계정이 새로 만들어지며 연결
--
-- 이메일·구글 등으로 가입한 계정 서비스 사용자는 기존 커데매 회원에
-- 붙지 않는다. 같은 사람인지 확인할 방법이 없기 때문이다.
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.linked_accounts
  DROP CONSTRAINT IF EXISTS linked_accounts_linked_via_check;

UPDATE public.linked_accounts SET linked_via = 'account' WHERE linked_via = 'explicit';

ALTER TABLE public.linked_accounts
  ADD CONSTRAINT linked_accounts_linked_via_check
  CHECK (linked_via IN ('kakao_id', 'account'));
