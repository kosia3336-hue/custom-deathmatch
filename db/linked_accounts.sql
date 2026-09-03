-- ─────────────────────────────────────────────────────────────
-- 드림샵 계정 연동
--
-- 두 서비스는 서로 다른 Supabase 프로젝트라 auth.users 를 공유할 수 없다.
-- 대신 "이 커데매 회원 = 저 드림샵 회원" 이라는 짝만 여기에 둔다.
--
-- 연결 방법 두 가지:
--   kakao_id : 커데매는 카카오 로그인을 자체 구현해 user_metadata.kakao_id 를
--              저장하고, 드림샵은 auth.identities.identity_data.sub 에 같은
--              값을 갖는다. 두 값이 같으면 같은 카카오 계정이므로 자동 연결.
--   account  : 계정 서비스를 거쳐 커데매 계정이 새로 만들어지며 연결된다.
--              (직접 연동 기능은 제거했다 — db/linked_accounts_v2.sql 참고)
--
-- 이메일로 매칭하지 않는 이유: 커데매 이메일은 kakao_*@kakao.internal 이라
-- 실제 이메일이 아니고, 드림샵과 우연히 겹치면 남의 계정에 붙는다.
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.linked_accounts (
  member_id          uuid PRIMARY KEY REFERENCES public.members (id) ON DELETE CASCADE,
  -- 드림샵 auth.users.id. 다른 프로젝트라 FK 를 걸 수 없으므로 UNIQUE 로만 지킨다.
  dreamshop_user_id  uuid NOT NULL UNIQUE,
  linked_via         text NOT NULL CHECK (linked_via IN ('kakao_id', 'account')),
  linked_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS linked_accounts_dreamshop_idx
  ON public.linked_accounts (dreamshop_user_id);

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

-- 정책을 두지 않는다 = service_role 만 접근한다.
-- 연동은 서버가 자동으로만 만들고, 화면에서 보여 주거나 사용자가 직접
-- 만들지 않는다. 클라이언트가 쓸 수 있으면 남의 계정에 붙일 수 있다.

-- ── 1회용 토큰 재사용 차단 ────────────────────────────────────
-- 드림샵이 발급한 토큰의 jti 를 소비 시점에 기록한다. 이미 있으면 거부.
CREATE TABLE IF NOT EXISTS public.sso_consumed_tokens (
  jti         text PRIMARY KEY,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sso_consumed_tokens_expires_idx
  ON public.sso_consumed_tokens (expires_at);

ALTER TABLE public.sso_consumed_tokens ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = service_role 만 접근

-- 만료된 기록 정리 (주기 실행용 — 없어도 동작에는 지장 없다)
CREATE OR REPLACE FUNCTION public.purge_consumed_sso_tokens()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.sso_consumed_tokens WHERE expires_at < now() - interval '1 day';
$$;
